import type { Document } from "@langchain/core/documents";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import type { RagRetrievalConfig } from "./ragEnv.js";

export type ScoredDoc = { doc: Document; score: number };

/**
 * 多取一些候选再按 scoreMin 过滤，最多保留 topK 条。
 * 若过滤后为空，则退回「分数最高的 topK 条」并标记 degraded。
 */
export async function retrieveRelevantChunks(
  store: MemoryVectorStore,
  question: string,
  cfg: RagRetrievalConfig,
): Promise<{ hits: ScoredDoc[]; degraded: boolean }> {
  const pool = Math.max(cfg.topK * 8, 24);
  const raw = await store.similaritySearchWithScore(question, pool);
  const scored: ScoredDoc[] = raw.map(([doc, score]) => ({ doc, score }));
  const passed = scored.filter((h) => h.score >= cfg.scoreMin).slice(0, cfg.topK);
  if (passed.length > 0) {
    return { hits: passed, degraded: false };
  }
  return {
    hits: scored.slice(0, cfg.topK),
    degraded: scored.length > 0,
  };
}
