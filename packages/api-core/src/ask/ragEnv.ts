/** 检索 topK 与余弦相似度下限（与 MemoryVectorStore 返回的分数一致：越高越相关）。 */
export type RagRetrievalConfig = {
  topK: number;
  scoreMin: number;
};

export function loadRagRetrievalConfig(): RagRetrievalConfig {
  const k = Number.parseInt(process.env.ARK_RAG_TOP_K ?? "4", 10);
  const topK = Number.isFinite(k) && k > 0 ? k : 4;
  const s = Number.parseFloat(process.env.ARK_RAG_SCORE_MIN ?? "0.35");
  const scoreMin = Number.isFinite(s) ? s : 0.35;
  return { topK, scoreMin };
}
