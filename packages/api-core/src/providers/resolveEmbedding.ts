import type { SerializedMemoryVector } from "../store/localVectorStore.js";
import { arkLikeEmbeddingsToEmbeddingProvider } from "../ai/adapters.js";
import { createAiDeps } from "../ai/factory.js";
import type { AiRuntimeMode } from "../ai/mode.js";
import type { EmbeddingProvider } from "./types.js";

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
  mode: AiRuntimeMode,
  existingRows: SerializedMemoryVector[],
): { provider: EmbeddingProvider; manifestEmbeddingModel: string } {
  const deps = createAiDeps(
    mode,
    mode === "offline"
      ? { offlineEmbedDimensions: inferOfflineEmbedDimensions(existingRows) }
      : {},
  );
  return {
    provider: arkLikeEmbeddingsToEmbeddingProvider(deps.embeddings),
    manifestEmbeddingModel: deps.manifestEmbeddingModelId,
  };
}
