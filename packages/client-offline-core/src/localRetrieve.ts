import type { SerializedMemoryVector } from "@kb-rag/shared";
import { searchWithScore, type MemoryVectorSearchHit } from "./memoryVectorIndex.js";

export type RagRetrievalConfigLite = {
  topK: number;
  scoreMin: number;
};

/** 与 `retrieveRelevantChunks` 返回的单条 `hits` 对齐（`doc` 含 `pageContent`/`metadata`，可喂给后续 `buildContextBlock` 移植版）。 */
export type LocalScoredHit = MemoryVectorSearchHit;

/** {@link MemoryVectorSearchHit}["doc"] 的别名，供外部解构类型使用。 */
export type LocalRetrievedDoc = MemoryVectorSearchHit["doc"];

/**
 * `retrieveRelevantChunks` 的进程内移植：入参已为查询向量（与 LangChain `similaritySearchWithScore` 使用同一 `queryEmbedding`）。
 *
 * 逻辑逐行对照 `packages/api-core/src/ask/retrieve.ts`：
 * - `pool = max(topK*8, 24)`
 * - `scored` = 池内候选（本实现由 {@link searchWithScore} 完成，等价于 `raw` 映射后）
 * - `passed = scored.filter(score >= scoreMin).slice(0, topK)`
 * - 若 `passed` 非空则 `degraded: false`；否则退回 `scored` 前 `topK` 条且 `degraded: scored.length > 0`
 */
export function localRetrieveRelevantChunks(
  vectors: SerializedMemoryVector[],
  questionEmbedding: readonly number[],
  cfg: RagRetrievalConfigLite,
): { hits: LocalScoredHit[]; degraded: boolean } {
  if (vectors.length === 0) {
    return { hits: [], degraded: false };
  }

  const pool = Math.max(cfg.topK * 8, 24);
  const scored: LocalScoredHit[] = searchWithScore(vectors, questionEmbedding, pool);
  const passed = scored.filter((h) => h.score >= cfg.scoreMin).slice(0, cfg.topK);
  if (passed.length > 0) {
    return { hits: passed, degraded: false };
  }
  return {
    hits: scored.slice(0, cfg.topK),
    degraded: scored.length > 0,
  };
}
