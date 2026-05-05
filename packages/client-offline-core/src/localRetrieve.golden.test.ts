import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SerializedMemoryVector } from "@kb-rag/shared";
import { retrieveRelevantChunks } from "../../api-core/src/ask/retrieve.js";
import { embeddingProviderToLangChain } from "../../api-core/src/providers/embeddingLangChainBridge.js";
import { OfflineStubEmbeddingProvider } from "../../api-core/src/providers/offline/stubEmbedding.js";
import { memoryStoreFromSerialized } from "../../api-core/src/store/localVectorStore.js";
import { getQueryEmbedding } from "./stubEmbed.js";
import { localRetrieveRelevantChunks } from "./localRetrieve.js";

/** 与 `scripts/compare-local-retrieve-golden.ts` 保持一致 */
const GOLDEN_USER_TEXT = "文档里关于猫和狗以及居家饲养的关键点是什么？";

function serializeHits(
  hits: { doc: { pageContent: string; metadata: Record<string, unknown> }; score: number }[],
): unknown[] {
  return hits.map((h) => ({
    preview80: h.doc.pageContent.slice(0, 80),
    score: h.score,
    chunkIndex: h.doc.metadata.chunkIndex,
  }));
}

describe("localRetrieveRelevantChunks vs retrieveRelevantChunks (golden)", () => {
  it("空 vectors 时与 retrieve 语义一致（无命中、非 degraded）", () => {
    const cfg = { topK: 4, scoreMin: 0.35 };
    const r = localRetrieveRelevantChunks([], getQueryEmbedding("x", 8), cfg);
    expect(r.hits).toEqual([]);
    expect(r.degraded).toBe(false);
  });

  it("matches LC MemoryVectorStore + stub embed", async () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(path.join(dir, "../__fixtures__/vectors.small.json"), "utf8");
    const rows = JSON.parse(raw) as SerializedMemoryVector[];
    const dim = rows[0]?.embedding.length;
    expect(dim).toBe(32);

    const cfg = { topK: 4, scoreMin: 0.35 };
    const prov = new OfflineStubEmbeddingProvider(dim);
    const store = await memoryStoreFromSerialized(embeddingProviderToLangChain(prov), rows);
    const lc = await retrieveRelevantChunks(store, GOLDEN_USER_TEXT, cfg);
    const qEmb = getQueryEmbedding(GOLDEN_USER_TEXT, dim);
    const local = localRetrieveRelevantChunks(rows, qEmb, cfg);

    expect(local.degraded).toBe(lc.degraded);
    const lcSer = serializeHits(
      lc.hits.map((h) => ({
        doc: { pageContent: h.doc.pageContent, metadata: h.doc.metadata as Record<string, unknown> },
        score: h.score,
      })),
    );
    expect(serializeHits(local.hits)).toEqual(lcSer);
  });
});
