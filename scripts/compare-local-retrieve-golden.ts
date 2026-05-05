/**
 * 对比 `localRetrieveRelevantChunks` 与 `retrieveRelevantChunks`（同一 fixture、同一 userText）。
 * 仓库根：`pnpm exec tsx scripts/compare-local-retrieve-golden.ts`
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SerializedMemoryVector } from "@kb-rag/shared";
import { retrieveRelevantChunks } from "../packages/api-core/src/ask/retrieve.js";
import { embeddingProviderToLangChain } from "../packages/api-core/src/providers/embeddingLangChainBridge.js";
import { OfflineStubEmbeddingProvider } from "../packages/api-core/src/providers/offline/stubEmbedding.js";
import { memoryStoreFromSerialized } from "../packages/api-core/src/store/localVectorStore.js";
import { getQueryEmbedding } from "../packages/client-offline-core/src/stubEmbed.js";
import { localRetrieveRelevantChunks } from "../packages/client-offline-core/src/localRetrieve.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function main(): Promise<void> {
  const fp = path.join(__dirname, "../packages/client-offline-core/__fixtures__/vectors.small.json");
  const rows = JSON.parse(readFileSync(fp, "utf8")) as SerializedMemoryVector[];
  const dim = rows[0]?.embedding.length;
  if (dim === undefined) {
    throw new Error("empty fixture");
  }
  const cfg = { topK: 4, scoreMin: 0.35 };
  const prov = new OfflineStubEmbeddingProvider(dim);
  const store = await memoryStoreFromSerialized(embeddingProviderToLangChain(prov), rows);
  const lc = await retrieveRelevantChunks(store, GOLDEN_USER_TEXT, cfg);
  const qEmb = getQueryEmbedding(GOLDEN_USER_TEXT, dim);
  const local = localRetrieveRelevantChunks(rows, qEmb, cfg);

  const a = serializeHits(
    lc.hits.map((h) => ({
      doc: { pageContent: h.doc.pageContent, metadata: h.doc.metadata as Record<string, unknown> },
      score: h.score,
    })),
  );
  const b = serializeHits(local.hits);

  if (lc.degraded !== local.degraded) {
    console.error("degraded mismatch", { lc: lc.degraded, local: local.degraded });
    process.exit(1);
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error("hits mismatch\nLC:\n", JSON.stringify(a, null, 2), "\nLocal:\n", JSON.stringify(b, null, 2));
    process.exit(1);
  }
  console.log("OK: localRetrieveRelevantChunks matches retrieveRelevantChunks (golden).");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
