/**
 * 与 LangChain `MemoryVectorStore` 默认 `similarity` 一致：即 `@langchain/classic` 内置的
 * ml-distance `cosine`（非「余弦距离」1−sim，而是**余弦相似度** dot/(||a||·||b||)）。
 *
 * 参考实现：`node_modules/@langchain/classic/dist/util/ml-distance/similarities.cjs` 中 `cosine(a,b)`。
 * `MemoryVectorStore._queryVectors` 按该值**降序**排序（越大越相似）。
 */
export function langchainCosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let p = 0;
  let p2 = 0;
  let q2 = 0;
  for (let i = 0; i < a.length; i++) {
    p += a[i] * b[i];
    p2 += a[i] * a[i];
    q2 += b[i] * b[i];
  }
  return p / (Math.sqrt(p2) * Math.sqrt(q2));
}
