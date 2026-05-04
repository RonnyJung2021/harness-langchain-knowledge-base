import { ChatOpenAI } from "@langchain/openai";
import type { ArkEnvConfig } from "../config.js";

/** 方舟 OpenAI 兼容对话（豆包等），temperature 固定 0.2 便于 RAG 稳定。 */
export function createArkChat(cfg: ArkEnvConfig): ChatOpenAI {
  return new ChatOpenAI({
    model: cfg.chatModel,
    temperature: 0.2,
    apiKey: cfg.apiKey,
    configuration: { baseURL: cfg.baseUrl },
  });
}
