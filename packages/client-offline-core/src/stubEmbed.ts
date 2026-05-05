/**
 * 与 `OfflineStubEmbeddingProvider` / LangChain `embedQuery` 对齐的离线桩嵌入（纯 JS，无 `node:fs` / LangChain）。
 *
 * @see `packages/api-core/src/providers/offline/stubEmbedding.ts`（本文件为算法复制，**禁止**从 api-core import）
 * @see `packages/api-core/src/providers/embeddingLangChainBridge.ts`（`embedQuery` → `embedTexts([q])[0]`，索引恒为 `0`）
 */
const DEFAULT_STUB_SEED = "offline-stub-v1";

function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 与 `packages/api-core/src/providers/offline/stubEmbedding.ts` 中 `offlineStubVector` **逐行一致**。
 */
export function offlineStubVector(dimensions: number, key: string): number[] {
  const out = new Array<number>(dimensions);
  let h = hashString(key);
  for (let i = 0; i < dimensions; i++) {
    h ^= (i + 1) * 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h ^= h >>> 13;
    out[i] = (h >>> 0) / 0xffffffff;
  }
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
  return out.map((x) => x / norm);
}

/**
 * 与 `OfflineStubEmbeddingProvider.embedTexts` 一致：第 `i` 条文本的 key 为 `` `${seed}:${i}:${text}` ``。
 */
export function embedTexts(texts: string[], dimensions: number, seed = DEFAULT_STUB_SEED): number[][] {
  return texts.map((t, i) => offlineStubVector(dimensions, `${seed}:${String(i)}:${t}`));
}

/**
 * 单条查询向量，等价于 `embedTexts([userText], dimensions, seed)[0]`（与 LangChain `embedQuery` 对齐）。
 */
export function getQueryEmbedding(userText: string, dimensions: number, seed = DEFAULT_STUB_SEED): number[] {
  const rows = embedTexts([userText], dimensions, seed);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("getQueryEmbedding：内部 embedTexts 返回空");
  }
  return row;
}
