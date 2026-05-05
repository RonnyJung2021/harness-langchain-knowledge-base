import type { RagTurnDeps } from "./chat/ragTurn.js";
import type { ArkEnvConfig } from "./config.js";
import {
  assertEmbeddingModelCompatible,
  memoryStoreFromSerialized,
  readManifest,
  readSerializedVectors,
} from "./store/localVectorStore.js";

export type ReloadVectorStoreOptions = {
  skipEmbeddingModelIdCheck?: boolean;
};

/**
 * 从磁盘 `kb_store` 重新构造内存向量库并写入 `ragTurnDeps.vectorStore`（与 `loadKbRagContext` 同源）。
 */
export async function reloadVectorStoreIntoRagDeps(
  repoRoot: string,
  arkConfig: ArkEnvConfig,
  ragTurnDeps: RagTurnDeps,
  opts?: ReloadVectorStoreOptions,
): Promise<void> {
  const rows = await readSerializedVectors(repoRoot);
  const manifest = await readManifest(repoRoot);
  assertEmbeddingModelCompatible(manifest, arkConfig.embedModel, {
    skipModelIdCheck: opts?.skipEmbeddingModelIdCheck === true,
  });
  ragTurnDeps.vectorStore = await memoryStoreFromSerialized(ragTurnDeps.embeddings, rows);
}
