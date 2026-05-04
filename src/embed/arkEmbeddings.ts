import type { Embeddings } from "@langchain/core/embeddings";
import { OpenAIEmbeddings } from "@langchain/openai";
import type { ArkEnvConfig } from "../config.js";
import { ArkMultimodalEmbeddings } from "./arkMultimodalEmbeddings.js";

/**
 * 根据 `ARK_EMBED_INPUT_MODE` 选择嵌入实现：
 * - `multimodal`（默认）：多模态向量端点，`input` 为 `[{ type: "text", text }]`。
 * - `text`：标准 OpenAI 文本 `input` 字符串，适用于纯文本 embedding 端点。
 */
export function createArkEmbeddings(cfg: ArkEnvConfig): Embeddings {
  if (cfg.embedInputMode === "text") {
    return new OpenAIEmbeddings({
      model: cfg.embedModel,
      apiKey: cfg.apiKey,
      configuration: { baseURL: cfg.baseUrl },
    });
  }
  return new ArkMultimodalEmbeddings({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.embedModel,
    dimensions: cfg.embedDimensions,
  });
}
