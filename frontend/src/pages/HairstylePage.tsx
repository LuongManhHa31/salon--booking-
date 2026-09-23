import { ChangeEvent, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { Hairstyle } from "../types";

interface SuggestResponse {
  faceShape: string;
  gender: string;
  features: string;
  advice: string;
  note?: string;
  suggestions: {
    best: Hairstyle[];
    okay: Hairstyle[];
    bad: Hairstyle[];
  };
}

const faceShapeLabel: Record<string, string> = {
  OVAL: "Trái xoan (Oval)",
  ROUND: "Tròn",
  SQUARE: "Vuông",
  HEART: "Trái tim",
  LONG: "Dài",
  DIAMOND: "Kim cương",
};

export function HairstylePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tryingOnId, setTryingOnId] = useState<string | null>(null);
  const [swappedImages, setSwappedImages] = useState<Record<string, string>>({});

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  useEffect(() => stopCamera, []);

  async function openCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError("Không thể truy cập camera. Vui lòng cấp quyền camera cho trình duyệt hoặc dùng cách tải ảnh lên.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const captured = new File([blob], `chan-dung-${Date.now()}.jpg`, { type: "image/jpeg" });
      setFile(captured);
      setResult(null);
      setError(null);
      setPreviewUrl(URL.createObjectURL(captured));
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await apiFetch<SuggestResponse>("/hairstyles/suggest", { method: "POST", body: formData });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không phân tích được ảnh, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  async function handleTryOn(hairstyleId: string, targetImageUrl: string) {
    if (!file) return;
    setTryingOnId(hairstyleId);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("targetImageUrl", targetImageUrl);
      const res = await apiFetch<{ imageUrl: string; isMock: boolean }>("/hairstyles/try-on", {
        method: "POST",
        body: formData,
      });
      setSwappedImages(prev => ({ ...prev, [hairstyleId]: res.imageUrl }));
      if (res.isMock) {
        alert("Hệ thống vẫn đang trả về ảnh giả lập (chưa có API Key).");
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Ghép ảnh thất bại");
    } finally {
      setTryingOnId(null);
    }
  }

  const renderHairstyleGrid = (hairstyles: Hairstyle[], colorClass: string, titleClass: string) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      {hairstyles.map((h, index) => (
        <div key={h.id || index} className="flex flex-col items-center">
          <div className={`w-full aspect-[3/4] rounded-lg overflow-hidden border-2 ${colorClass} mb-2 relative group`}>
            {swappedImages[h.id] ? (
              <img src={swappedImages[h.id]} alt="Kết quả ghép" className="w-full h-full object-cover" />
            ) : h.imageUrl ? (
              <img src={h.imageUrl} alt={h.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                Chưa có ảnh
              </div>
            )}
            
            {!swappedImages[h.id] && (
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {tryingOnId === h.id ? (
                  <span className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang ghép...
                  </span>
                ) : (
                  <button
                    onClick={() => h.imageUrl && handleTryOn(h.id, h.imageUrl)}
                    className="bg-white text-gray-900 px-4 py-2 rounded-full text-xs font-semibold shadow-lg hover:bg-gray-100 hover:scale-105 transition-transform"
                  >
                    Ghép thử ngay
                  </button>
                )}
              </div>
            )}
          </div>
          <p className={`text-xs font-bold text-center uppercase ${titleClass}`}>
            {index + 1}. {h.name.split(" - ")[0]}
          </p>
          <p className="text-[10px] text-gray-500 text-center px-1 truncate w-full uppercase">
            {h.name.split(" - ")[1] || ""}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      
      {!result ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-2xl mx-auto border border-gray-100">
          <h1 className="text-3xl font-bold text-brand-800 mb-4">PHÂN TÍCH KIỂU TÓC CÁ NHÂN</h1>
          <p className="text-gray-600 mb-8">
            Hệ thống AI sẽ phân tích tỷ lệ khuôn mặt và gợi ý kiểu tóc phù hợp nhất với bạn.
          </p>

          <div className="flex flex-col items-center gap-4">
            {previewUrl ? (
              <div className="relative">
                <img src={previewUrl} alt="Preview" className="w-48 h-48 object-cover rounded-full border-4 border-brand-100 shadow-md" />
                {!cameraOpen && (
                  <button onClick={() => setFile(null)} className="absolute -bottom-2 right-4 bg-white border border-gray-200 text-sm px-3 py-1 rounded-full shadow-sm hover:bg-gray-50">
                    Đổi ảnh
                  </button>
                )}
              </div>
            ) : (
              <div className="w-48 h-48 rounded-full bg-brand-50 border-4 border-dashed border-brand-200 flex flex-col items-center justify-center text-brand-400">
                <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm">Chưa có ảnh</span>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 mt-4">
              <label className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-full cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm text-sm font-medium">
                Tải ảnh lên
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              </label>
              {!cameraOpen && (
                <button
                  onClick={openCamera}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-full hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm text-sm font-medium"
                >
                  Chụp ảnh
                </button>
              )}
            </div>

            {cameraError && <p className="text-sm text-red-500 mt-2">{cameraError}</p>}

            {cameraOpen && (
              <div className="mt-4 flex flex-col items-center">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm rounded-2xl border-4 border-gray-200 mb-4 bg-black" />
                <div className="flex gap-3">
                  <button onClick={capturePhoto} className="bg-brand-600 text-white px-8 py-2.5 rounded-full hover:bg-brand-700 font-medium shadow-md">
                    Chụp ngay
                  </button>
                  <button onClick={stopCamera} className="bg-white border border-gray-300 px-6 py-2.5 rounded-full text-gray-700 font-medium shadow-sm">
                    Huỷ
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className={`mt-6 w-full max-w-xs px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all ${
                !file || loading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 hover:scale-105"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang phân tích AI...
                </span>
              ) : "Bắt đầu phân tích"}
            </button>
            
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 max-w-3xl mx-auto">
          {/* Header Báo Cáo */}
          <div className="bg-white py-6 px-6 text-center">
            <h1 className="text-2xl font-black text-blue-900 tracking-wider">
              ✨ PHÂN TÍCH KIỂU TÓC CÁ NHÂN ✨
            </h1>
          </div>

          {/* Box Phân tích */}
          <div className="px-6 md:px-12 flex flex-col md:flex-row gap-8 items-center pb-8 border-b border-gray-100">
            <div className="w-48 h-48 flex-shrink-0 relative">
              <img src={previewUrl!} alt="User" className="w-full h-full object-cover rounded-full shadow-sm" />
            </div>
            
            <div className="flex-1 bg-blue-50/60 rounded-2xl p-6 border border-blue-100 shadow-sm relative">
              <div className="absolute -top-4 left-6 bg-white border border-blue-200 px-4 py-1 rounded-full flex items-center gap-2 text-blue-800 shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-sm font-bold tracking-wide">PHÂN TÍCH</h2>
              </div>
              
              <ul className="space-y-4 text-gray-700 text-sm md:text-sm mt-3">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">●</span>
                  <div>
                    <strong>Loại khuôn mặt:</strong> {faceShapeLabel[result.faceShape] ?? result.faceShape}
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">★</span>
                  <div>
                    <strong>Đặc điểm nổi bật:</strong>
                    <p className="text-gray-600 mt-1">{result.features}</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">💡</span>
                  <div>
                    <strong>Gợi ý tổng quan:</strong>
                    <p className="text-gray-600 mt-1">{result.advice}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Các nhóm gợi ý */}
          <div className="p-6 md:p-8 space-y-12">
            
            {/* Phù hợp nhất */}
            <div className="border border-green-200 rounded-xl p-4 md:p-6 bg-white relative mt-6">
              <div className="absolute -top-5 left-4 inline-flex items-center gap-2 bg-green-500 text-white px-4 py-1.5 rounded-full font-bold shadow-md">
                <span className="text-lg">👍</span> PHÙ HỢP NHẤT
              </div>
              {renderHairstyleGrid(result.suggestions.best, "border-green-100", "text-green-700")}
            </div>

            {/* Khá phù hợp */}
            <div className="border border-yellow-200 rounded-xl p-4 md:p-6 bg-white relative mt-6">
              <div className="absolute -top-5 left-4 inline-flex items-center gap-2 bg-yellow-400 text-white px-4 py-1.5 rounded-full font-bold shadow-md">
                <span className="text-lg">⭐</span> KHÁ PHÙ HỢP
              </div>
              {renderHairstyleGrid(result.suggestions.okay, "border-yellow-100", "text-yellow-600")}
            </div>

            {/* Không phù hợp */}
            <div className="border border-red-200 rounded-xl p-4 md:p-6 bg-white relative mt-6">
              <div className="absolute -top-5 left-4 inline-flex items-center gap-2 bg-red-500 text-white px-4 py-1.5 rounded-full font-bold shadow-md">
                <span className="text-lg">👎</span> KHÔNG PHÙ HỢP
              </div>
              {renderHairstyleGrid(result.suggestions.bad, "border-red-100", "text-red-700")}
            </div>
            
          </div>
          
          <div className="p-6 text-center border-t border-gray-100 bg-gray-50">
            <button 
              onClick={() => {
                setResult(null);
                setFile(null);
                setPreviewUrl(null);
                setSwappedImages({});
              }}
              className="text-brand-600 font-medium hover:underline px-6 py-2 rounded-full border border-brand-200 bg-white"
            >
              Phân tích lại ảnh khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
