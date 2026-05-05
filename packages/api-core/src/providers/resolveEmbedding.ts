import type { SerializedMemoryVector } from "../store/localVectorStore.js";
import { OFFLINE_EMBEDDING_MODEL } from "./constants.js";
import { OfflineStubEmbeddingProvider } from "./offline/stubEmbedding.js";
import { VolcanoArkEmbeddingProvider } from "./volcano/VolcanoArkEmbeddingProvider.js";
import type { RuntimeMode } from "@kb-rag/shared";

const DEFAULT_OFFLINE_DIM = 1024;

function parseOfflineStubEmbedDimFromEnv(): number {
  const raw = process.env.OFFLINE_STUB_EMBED_DIM?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_OFFLINE_DIM;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 8 || n > 8192) {
    return DEFAULT_OFFLINE_DIM;
  }
  return n;
}

/**
 * 从已有向量行推断离线占位向量维度；空库时使用 `OFFLINE_STUB_EMBED_DIM`（默认 1024）。
 */
export function inferOfflineEmbedDimensions(rows: SerializedMemoryVector[]): number {
  const len = rows[0]?.embedding.length;
  if (len !== undefined && len > 0) {
    return len;
  }
  return parseOfflineStubEmbedDimFromEnv();
}

export function resolveEmbeddingForIngest(
  mode: RuntimeMode,
  existingRows: SerializedMemoryVector[],
): { provider: VolcanoArkEmbeddingProvider | OfflineStubEmbeddingProvider; manifestEmbeddingModel: string } {
  if (mode === "online") {
    const p = new VolcanoArkEmbeddingProvider();
    return { provider: p, manifestEmbeddingModel: p.manifestEmbeddingModelId };
  }
  const dim = inferOfflineEmbedDimensions(existingRows);
  return {
    provider: new OfflineStubEmbeddingProvider(dim),
    manifestEmbeddingModel: OFFLINE_EMBEDDING_MODEL,
  };
}
