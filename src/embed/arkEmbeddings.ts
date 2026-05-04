import { OpenAIEmbeddings } from "@langchain/openai";
import type { ArkEnvConfig } from "../config.js";

/** 方舟 OpenAI 兼容 Embeddings（baseURL + apiKey + Endpoint ID 模型名）。 */
export function createArkEmbeddings(cfg: ArkEnvConfig): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    model: cfg.embedModel,
    apiKey: cfg.apiKey,
    configuration: { baseURL: cfg.baseUrl },
  });
}
