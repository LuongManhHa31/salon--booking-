import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const keys = (process.env.GEMINI_API_KEY ?? "").split(",").map(k => k.trim());
console.log("Testing with key:", keys[0].substring(0, 10) + "...");

const client = new GoogleGenAI({ apiKey: keys[0] });

async function run() {
  try {
    const chat = client.chats.create({
        model: "gemini-1.5-flash",
    });
    const response = await chat.sendMessage({ message: "Hello" });
    console.log("Success:", response.text);
  } catch (err) {
    console.error("Error from Gemini:");
    console.error(err);
  }
}
run();
