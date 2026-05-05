import type { SerializedMemoryVector } from "@kb-rag/shared";
import { langchainCosineSimilarity } from "./langchainCosine.js";

/**
 * 与 LangChain `MemoryVectorStore` 默认 `similarity`（ml-distance `cosine`）一致：
 * dot(a,b) / (||a||·||b||)，**越大越相似**。
 *
 * @see `packages/client-offline-core/src/langchainCosine.ts`
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  return langchainCosineSimilarity(a, b);
}

/** `searchWithScore` 单条结果；`score` 与 `packages/api-core/src/ask/retrieve.ts` 中 `h.score` 语义一致。 */
export type MemoryVectorSearchHit = {
  doc: {
    pageContent: string;
    metadata: Record<string, unknown>;
  };
  score: number;
};

/**
 * 在内存向量表上做相似度检索：对每条 `SerializedMemoryVector` 计算与 `queryEmbedding` 的余弦相似度，
 * 按 **score 降序**取前 `poolSize` 条（与 `MemoryVectorStore._queryVectors` → `similaritySearchWithScore` 的池大小语义一致）。
 *
 * `poolSize` 通常取 `max(topK * 8, 24)`，由调用方传入（与 `retrieveRelevantChunks` 内 `pool` 一致）。
 */
export function searchWithScore(
  rows: SerializedMemoryVector[],
  queryEmbedding: readonly number[],
  poolSize: number,
): MemoryVectorSearchHit[] {
  if (rows.length === 0) {
    return [];
  }
  const dim = queryEmbedding.length;
  if (!Number.isFinite(dim) || dim < 1) {
    throw new Error("searchWithScore：queryEmbedding 维度无效");
  }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.embedding.length !== dim) {
      throw new Error(`searchWithScore：第 ${String(i)} 条 embedding 长度与 query 不一致`);
    }
  }

  const k = Math.max(0, Math.floor(poolSize));
  const scored: MemoryVectorSearchHit[] = rows.map((row) => ({
    doc: {
      pageContent: row.content,
      metadata: { ...row.metadata },
    },
    score: cosineSimilarity(queryEmbedding, row.embedding),
  }));
  scored.sort((a, b) => (a.score > b.score ? -1 : a.score < b.score ? 1 : 0));
  return scored.slice(0, Math.min(k, scored.length));
}
