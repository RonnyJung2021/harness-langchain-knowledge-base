import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { loadArkConfig, type ArkEnvConfig } from "../config.js";
import { createArkEmbeddings } from "../embed/arkEmbeddings.js";
import { getRepoRoot } from "../paths/repoRoot.js";
import { loadRagRetrievalConfig, type RagRetrievalConfig } from "../ask/ragEnv.js";
import {
  assertEmbeddingModelCompatible,
  memoryStoreFromSerialized,
  readManifest,
  readSerializedVectors,
} from "../store/localVectorStore.js";

export type KbRagLoadedContext = {
  cfg: ArkEnvConfig;
  ragCfg: RagRetrievalConfig;
  embeddings: EmbeddingsInterface;
  vectorStore: MemoryVectorStore;
};

/**
 * 与 `ask` / 多轮 `chat` 同源：加载 manifest、向量行并构造内存向量库。
 */
export async function loadKbRagContext(): Promise<KbRagLoadedContext> {
  const repoRoot = getRepoRoot();
  const cfg = loadArkConfig();
  const ragCfg = loadRagRetrievalConfig();

  const rows = await readSerializedVectors(repoRoot);
  if (rows.length === 0) {
    throw new Error(
      "未找到向量数据：请先执行 `pnpm ingest -- pdfs/某文件.pdf` 写入 kb_store 后再提问。",
    );
  }

  const manifest = await readManifest(repoRoot);
  assertEmbeddingModelCompatible(manifest, cfg.embedModel);

  const embeddings = createArkEmbeddings(cfg);
  const vectorStore = await memoryStoreFromSerialized(embeddings, rows);

  return { cfg, ragCfg, embeddings, vectorStore };
}
