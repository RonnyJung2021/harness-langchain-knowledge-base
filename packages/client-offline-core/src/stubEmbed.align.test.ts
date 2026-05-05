import { describe, expect, it } from "vitest";
import {
  OfflineStubEmbeddingProvider,
  offlineStubVector as refOfflineStubVector,
} from "../../api-core/src/providers/offline/stubEmbedding.js";
import { embedTexts, getQueryEmbedding, offlineStubVector } from "./stubEmbed.js";

function expectVecEqual(a: readonly number[], b: readonly number[]): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i]).toBe(b[i]);
  }
}

describe("stubEmbed vs api-core stubEmbedding（字符级 / 逐元素）", () => {
  it("offlineStubVector 多组 dimensions × key 与 ref 完全一致", () => {
    const keys = ["", "a", "hello 世界", "x".repeat(400), "offline-stub-v1:0:query?\n\t"];
    const dims = [1, 8, 16, 32, 64, 1024];
    for (const dim of dims) {
      for (const key of keys) {
        expectVecEqual(offlineStubVector(dim, key), refOfflineStubVector(dim, key));
      }
    }
  });

  it("embedTexts 与 OfflineStubEmbeddingProvider.embedTexts 完全一致（默认 seed）", async () => {
    const dimensions = 32;
    const texts = ["仅一条", "第二条", "third", ""];
    const ref = new OfflineStubEmbeddingProvider(dimensions);
    const refRows = await ref.embedTexts(texts);
    const localRows = embedTexts(texts, dimensions);
    expect(localRows.length).toBe(refRows.length);
    for (let i = 0; i < localRows.length; i++) {
      expectVecEqual(localRows[i]!, refRows[i]!);
    }
  });

  it("embedTexts 自定义 seed 与 Provider 一致", async () => {
    const dimensions = 16;
    const seed = "custom-seed-xyz";
    const texts = ["alpha", "beta"];
    const ref = new OfflineStubEmbeddingProvider(dimensions, seed);
    const refRows = await ref.embedTexts(texts);
    const localRows = embedTexts(texts, dimensions, seed);
    expectVecEqual(localRows[0]!, refRows[0]!);
    expectVecEqual(localRows[1]!, refRows[1]!);
  });

  it("getQueryEmbedding 等价 embedTexts 单条且与 embedQuery 路径一致", async () => {
    const dimensions = 48;
    const q = "用户问题含 emoji 🐱 与数字 42";
    const ref = new OfflineStubEmbeddingProvider(dimensions);
    const refOne = await ref.embedTexts([q]);
    expectVecEqual(getQueryEmbedding(q, dimensions), refOne[0]!);
  });
});
