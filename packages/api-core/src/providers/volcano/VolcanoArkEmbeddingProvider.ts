import type { Embeddings } from "@langchain/core/embeddings";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ArkMultimodalEmbeddings } from "../../embed/arkMultimodalEmbeddings.js";
import type { EmbeddingProvider } from "../types.js";
import { loadVolcanoArkEnvConfig } from "./arkEnv.js";

function buildLangChainEmbeddings(cfg: ReturnType<typeof loadVolcanoArkEnvConfig>): Embeddings {
  if (cfg.embedInputMode === "text") {
    return new OpenAIEmbeddings({
      model: cfg.embedModel,
      apiKey: cfg.apiKey,
      timeout: cfg.requestTimeoutMs,
      configuration: { baseURL: cfg.baseUrl, timeout: cfg.requestTimeoutMs },
    });
  }
  return new ArkMultimodalEmbeddings({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.embedModel,
    dimensions: cfg.embedDimensions,
    timeoutMs: cfg.requestTimeoutMs,
  });
}

/**
 * 火山引擎方舟嵌入（OpenAI 兼容）。在本类构造时读取 ARK_* 并创建唯一 LangChain Embeddings 实例。
 */
export class VolcanoArkEmbeddingProvider implements EmbeddingProvider {
  private readonly lc: Embeddings;

  /** 与 manifest.embeddingModel 对齐的模型 ID */
  readonly manifestEmbeddingModelId: string;

  constructor() {
    const cfg = loadVolcanoArkEnvConfig();
    this.manifestEmbeddingModelId = cfg.embedModel;
    this.lc = buildLangChainEmbeddings(cfg);
  }

  embedTexts(texts: string[]): Promise<number[][]> {
    return this.lc.embedDocuments(texts);
  }
}
