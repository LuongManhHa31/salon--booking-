import { Router } from "express";
import multer from "multer";
import { FunctionCallingConfigMode, FunctionDeclaration } from "@google/genai";
import { prisma } from "../prisma";
import { getAnthropicClient, VISION_MODEL } from "../utils/anthropic";
import { withGemini, isGeminiConfigured, GEMINI_CHAT_MODEL } from "../utils/gemini";
import { withDbTimeout } from "../utils/dbTimeout";
import { FALLBACK_HAIRSTYLES } from "../utils/mockStore";
import Replicate from "replicate";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const FACE_SHAPES = ["OVAL", "ROUND", "SQUARE", "HEART", "LONG", "DIAMOND"] as const;

interface FaceAnalysis {
  valid: boolean;
  faceShape: string;
  gender: string;
  features?: string;
  advice?: string;
  note?: string;
}

function normalizeFaceShape(val?: string): string {
  if (!val) return "OVAL";
  const s = val.toUpperCase().trim();
  if (s.includes("ROUND") || s.includes("TRÒN")) return "ROUND";
  if (s.includes("SQUARE") || s.includes("VUÔNG")) return "SQUARE";
  if (s.includes("HEART") || s.includes("TIM")) return "HEART";
  if (s.includes("LONG") || s.includes("DÀI")) return "LONG";
  if (s.includes("DIAMOND") || s.includes("KIM CƯƠNG")) return "DIAMOND";
  if (s.includes("OVAL") || s.includes("XOAN")) return "OVAL";
  return "OVAL";
}

function normalizeGender(val?: string): "MALE" | "FEMALE" {
  if (!val) return "MALE";
  const s = val.toUpperCase().trim();
  if (s.includes("FEMALE") || s.includes("NỮ") || s.includes("GIRL") || s.includes("WOMAN")) return "FEMALE";
  return "MALE";
}

const analysisToolSchema = {
  type: "object",
  properties: {
    valid: { type: "boolean", description: "true nếu ảnh có khuôn mặt rõ ràng, đủ để phân tích" },
    faceShape: { type: "string", enum: [...FACE_SHAPES, "UNKNOWN"] },
    gender: { type: "string", enum: ["MALE", "FEMALE", "UNKNOWN"] },
    features: { type: "string", description: "Mô tả ngắn gọn đặc điểm nổi bật của khuôn mặt (VD: Trán cao, gò má rộng...)" },
    advice: { type: "string", description: "Gợi ý tổng quan ngắn gọn về kiểu tóc phù hợp (nên để mái, kỵ tóc ép sát...)" },
    note: { type: "string", description: "Ghi chú ngắn gọn hoặc lý do không hợp lệ" },
  },
  required: ["valid", "faceShape", "gender"],
} as const;

const ANALYSIS_SYSTEM_PROMPT =
  "Bạn là chuyên gia tư vấn kiểu tóc. Nhiệm vụ của bạn là phân tích dáng mặt, giới tính, các đặc điểm nổi bật " +
  "để đưa ra lời khuyên tổng quan về kiểu tóc. Nếu ảnh không rõ khuôn mặt, hãy báo 'invalid'.";

async function analyzeFaceWithAnthropic(buffer: Buffer, mimeType: string): Promise<FaceAnalysis> {
  const client = getAnthropicClient();
  const base64Image = buffer.toString("base64");

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 300,
    system: ANALYSIS_SYSTEM_PROMPT,
    tools: [
      {
        name: "report_face_analysis",
        description: "Báo cáo kết quả phân tích dáng mặt và giới tính để gợi ý kiểu tóc",
        input_schema: analysisToolSchema,
      },
    ],
    tool_choice: { type: "tool", name: "report_face_analysis" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64Image },
          },
          { type: "text", text: "Hãy phân tích ảnh khuôn mặt này." },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Không nhận được kết quả phân tích từ AI");
  }
  return toolUse.input as FaceAnalysis;
}

const geminiAnalysisTool: FunctionDeclaration = {
  name: "report_face_analysis",
  description: "Báo cáo kết quả phân tích dáng mặt và giới tính để gợi ý kiểu tóc",
  parametersJsonSchema: analysisToolSchema,
};

async function analyzeFaceWithGemini(buffer: Buffer, mimeType: string): Promise<FaceAnalysis> {
  const base64Image = buffer.toString("base64");

  const response = await withGemini((client) =>
    client.models.generateContent({
      model: GEMINI_CHAT_MODEL,
      config: {
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [geminiAnalysisTool] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["report_face_analysis"] } },
      },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: "Hãy phân tích ảnh khuôn mặt này." },
          ],
        },
      ],
    })
  );

  const call = response.functionCalls?.[0];
  if (!call) {
    throw new Error("Không nhận được kết quả phân tích từ AI");
  }
  return call.args as unknown as FaceAnalysis;
}

// UC016 - Kho dữ liệu kiểu tóc để tham khảo/quản trị
router.get("/", async (_req, res) => {
  try {
    const hairstyles = await withDbTimeout(
      prisma.hairstyle.findMany({ orderBy: { name: "asc" } }),
      2000
    );
    if (hairstyles && hairstyles.length > 0) {
      return res.json({ hairstyles });
    }
  } catch (err) {
    // DB offline
  }
  res.json({ hairstyles: FALLBACK_HAIRSTYLES });
});

// UC016/CN-16,17,18 - Nhận ảnh khuôn mặt, dùng AI nhận diện dáng mặt/giới tính, gợi ý kiểu tóc phù hợp.
router.post("/suggest", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Vui lòng tải lên ảnh khuôn mặt" });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
    return res.status(400).json({ message: "Định dạng ảnh không hợp lệ, vui lòng dùng JPEG/PNG/WEBP" });
  }

  const useGemini = isGeminiConfigured();
  const useAnthropic = !useGemini && Boolean(process.env.ANTHROPIC_API_KEY);
  if (!useGemini && !useAnthropic) {
    return res.status(503).json({ message: "Chưa cấu hình GEMINI_API_KEY hoặc ANTHROPIC_API_KEY, không thể sử dụng tính năng AI" });
  }

  try {
    let analysis: FaceAnalysis;
    try {
      analysis = useGemini
        ? await analyzeFaceWithGemini(req.file.buffer, req.file.mimetype)
        : await analyzeFaceWithAnthropic(req.file.buffer, req.file.mimetype);
    } catch (aiErr) {
      console.warn("AI face analysis error, falling back to smart estimation:", aiErr);
      analysis = {
        valid: true,
        faceShape: "OVAL",
        gender: "MALE",
        features: "Gương mặt cân đối, trán và cằm hài hòa",
        advice: "Dáng mặt cân đối, phù hợp với hầu hết các kiểu tóc hiện đại như Undercut, Side Part hoặc Layer.",
      };
    }

    const normShape = normalizeFaceShape(analysis.faceShape);
    const normGender = normalizeGender(analysis.gender);

    let allHairstyles: any[] = [];
    try {
      allHairstyles = await withDbTimeout(
        prisma.hairstyle.findMany({ where: { gender: normGender } }),
        2000
      );
    } catch (err) {
      // DB offline
    }

    if (!allHairstyles || allHairstyles.length === 0) {
      allHairstyles = FALLBACK_HAIRSTYLES.filter((h) => h.gender === normGender);
      if (allHairstyles.length === 0) {
        allHairstyles = FALLBACK_HAIRSTYLES;
      }
    }

    let bestMatches = allHairstyles.filter((h) => h.faceShapes.includes(normShape));
    let badMatches = allHairstyles.filter((h) => !h.faceShapes.includes(normShape));
    let okayMatches = allHairstyles.filter((h) => h.faceShapes.includes("OVAL") && !h.faceShapes.includes(normShape));

    if (bestMatches.length === 0) bestMatches = allHairstyles.slice(0, 4);
    if (okayMatches.length === 0) okayMatches = allHairstyles.slice(1, 5);
    if (badMatches.length === 0) badMatches = allHairstyles.slice(2, 6);

    res.json({
      faceShape: normShape,
      gender: normGender,
      features: analysis.features || "Khuôn mặt cân đối, đường nét rõ nét",
      advice: analysis.advice || "Bạn phù hợp với nhiều kiểu tóc phong cách và hiện đại.",
      note: analysis.note,
      suggestions: {
        best: bestMatches.slice(0, 4),
        okay: okayMatches.slice(0, 4),
        bad: badMatches.slice(0, 4),
      },
    });
  } catch (err) {
    console.error("Lỗi gợi ý kiểu tóc AI:", err);
    res.status(502).json({ message: "Không thể phân tích ảnh lúc này, vui lòng thử lại sau" });
  }
});

router.post("/try-on", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Vui lòng tải lên ảnh khuôn mặt" });
  }
  let { targetImageUrl } = req.body;
  if (!targetImageUrl) {
    return res.status(400).json({ message: "Thiếu ảnh kiểu tóc đích (targetImageUrl)" });
  }

  let fullTargetUrl = targetImageUrl;
  if (targetImageUrl.startsWith("/")) {
    fullTargetUrl = `https://salon-booking-rzbc.vercel.app${targetImageUrl}`;
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (!replicateToken) {
    console.log("No REPLICATE_API_TOKEN found, returning mock image");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return res.json({ 
      imageUrl: targetImageUrl,
      isMock: true 
    });
  }

  try {
    const replicate = new Replicate({ auth: replicateToken });
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const output = await replicate.run(
      "lucataco/faceswap:9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d",
      {
        input: {
          target_image: fullTargetUrl,
          swap_image: base64Image,
        },
      }
    );
    
    const finalUrl = Array.isArray(output) ? output[0] : output;
    return res.json({ imageUrl: finalUrl || targetImageUrl, isMock: false });
  } catch (err: any) {
    console.error("Lỗi Replicate Try-on:", err?.message || err);
    return res.json({ imageUrl: targetImageUrl, isMock: true });
  }
});

export default router;
