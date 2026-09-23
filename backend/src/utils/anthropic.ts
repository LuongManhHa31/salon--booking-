import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Chưa cấu hình ANTHROPIC_API_KEY, không thể sử dụng tính năng AI");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const CHAT_MODEL = "claude-sonnet-5";
export const VISION_MODEL = "claude-sonnet-5";
