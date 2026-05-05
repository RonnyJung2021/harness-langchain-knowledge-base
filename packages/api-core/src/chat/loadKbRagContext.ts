import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import type { RuntimeMode } from "@kb-rag/shared";
import type { ArkEnvConfig } from "../config.js";
import { getRepoRoot } from "../paths/repoRoot.js";
import { embeddingProviderToLangChain } from "../providers/embeddingLangChainBridge.js";
import {
  inferOfflineEmbedDimensions,
  resolveEmbeddingForIngest,
} from "../providers/resolveEmbedding.js";
import { loadVolcanoArkEnvConfig } from "../providers/volcano/arkEnv.js";
import { loadRagRetrievalConfig, type RagRetrievalConfig } from "../ask/ragEnv.js";
import {
  assertEmbeddingModelCompatible,
  memoryStoreFromSerialized,
  readManifest,
  readSerializedVectors,
} from "../store/localVectorStore.js";
import { OFFLINE_CHAT_MODEL, OFFLINE_EMBEDDING_MODEL } from "../providers/constants.js";

export type KbRagLoadedContext = {
  cfg: ArkEnvConfig;
  ragCfg: RagRetrievalConfig;
  embeddings: EmbeddingsInterface;
  vectorStore: MemoryVectorStore;
};

function nominalEmbedDimensionsFromCount(dim: number): 1024 | 2048 {
  return dim >= 1536 ? 2048 : 1024;
}

function buildOfflineArkEnvStub(vectorDim: number): ArkEnvConfig {
  return {
    apiKey: "",
    baseUrl: "",
    chatModel: OFFLINE_CHAT_MODEL,
    embedModel: OFFLINE_EMBEDDING_MODEL,
    embedInputMode: "text",
    embedDimensions: nominalEmbedDimensionsFromCount(vectorDim),
    requestTimeoutMs: 0,
  };
}

/**
 * 与 `ask` / 多轮 `chat` 同源：加载 manifest、向量行并构造内存向量库。
 * @param mode 在线走方舟嵌入；离线用占位向量（维度与 kb_store 首条向量一致）。
 */
export async function loadKbRagContext(mode: RuntimeMode): Promise<KbRagLoadedContext> {
  const repoRoot = getRepoRoot();
  const ragCfg = loadRagRetrievalConfig();

  const rows = await readSerializedVectors(repoRoot);
  if (rows.length === 0) {
    throw new Error(
      "未找到向量数据：请先执行 `pnpm ingest -- pdfs/某文件.pdf` 写入 kb_store 后再提问。",
    );
  }

  const manifest = await readManifest(repoRoot);

  const offlineDims = inferOfflineEmbedDimensions(rows);
  const cfg: ArkEnvConfig =
    mode === "online" ? loadVolcanoArkEnvConfig() : buildOfflineArkEnvStub(offlineDims);

  assertEmbeddingModelCompatible(manifest, cfg.embedModel, {
    skipModelIdCheck: mode === "offline",
  });

  const { provider } = resolveEmbeddingForIngest(mode, rows);
  const embeddings = embeddingProviderToLangChain(provider);
  const vectorStore = await memoryStoreFromSerialized(embeddings, rows);

  return { cfg, ragCfg, embeddings, vectorStore };
}
