import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SerializedMemoryVector } from "@kb-rag/shared";
import { embeddingProviderToLangChain } from "../../api-core/src/providers/embeddingLangChainBridge.js";
import { OfflineStubEmbeddingProvider } from "../../api-core/src/providers/offline/stubEmbedding.js";
import { memoryStoreFromSerialized } from "../../api-core/src/store/localVectorStore.js";
import { getQueryEmbedding } from "./stubEmbed.js";
import { cosineSimilarity, searchWithScore } from "./memoryVectorIndex.js";

describe("memoryVectorIndex.searchWithScore", () => {
  it("与 MemoryVectorStore.similaritySearchVectorWithScore 池内顺序与分数一致", async () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const rows = JSON.parse(
      readFileSync(path.join(dir, "../__fixtures__/vectors.small.json"), "utf8"),
    ) as SerializedMemoryVector[];
    const dim = rows[0]!.embedding.length;
    const poolSize = 10;
    const qText = "猫与狗饲养";
    const q = getQueryEmbedding(qText, dim);

    const local = searchWithScore(rows, q, poolSize);

    const prov = new OfflineStubEmbeddingProvider(dim);
    const store = await memoryStoreFromSerialized(embeddingProviderToLangChain(prov), rows);
    const lcRaw = await store.similaritySearchVectorWithScore(q, poolSize);

    expect(local.length).toBe(lcRaw.length);
    for (let i = 0; i < local.length; i++) {
      const [lcDoc, lcScore] = lcRaw[i]!;
      expect(local[i]!.score).toBe(lcScore);
      expect(local[i]!.doc.pageContent).toBe(lcDoc.pageContent);
      expect(local[i]!.doc.metadata).toEqual({ ...lcDoc.metadata });
    }
  });

  it("cosineSimilarity：单位向量与自身为 1", () => {
    const u = [1, 0, 0];
    expect(cosineSimilarity(u, u)).toBe(1);
  });
});
