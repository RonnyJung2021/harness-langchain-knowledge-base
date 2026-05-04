import fs from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

export const VECTORS_FILENAME = "vectors.json";
export const MANIFEST_FILENAME = "manifest.json";

export type SerializedMemoryVector = {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  id?: string;
};

export type KbManifestV1 = {
  version: 1;
  updatedAt: string;
  embeddingModel: string;
  totalChunks: number;
  sources: string[];
  lastIngest?: {
    source: string;
    chunkCount: number;
    durationMs: number;
  };
};

export function kbStoreDir(repoRoot: string): string {
  return path.join(repoRoot, "kb_store");
}

export function vectorsPath(repoRoot: string): string {
  return path.join(kbStoreDir(repoRoot), VECTORS_FILENAME);
}

export function manifestPath(repoRoot: string): string {
  return path.join(kbStoreDir(repoRoot), MANIFEST_FILENAME);
}

export async function readSerializedVectors(
  repoRoot: string,
): Promise<SerializedMemoryVector[]> {
  const file = vectorsPath(repoRoot);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`${VECTORS_FILENAME} 格式错误：根节点须为数组。`);
    }
    return parsed as SerializedMemoryVector[];
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return [];
    }
    throw e;
  }
}

export async function readManifest(
  repoRoot: string,
): Promise<KbManifestV1 | null> {
  const file = manifestPath(repoRoot);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as KbManifestV1;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }
    throw e;
  }
}

export async function ensureKbStoreDir(repoRoot: string): Promise<void> {
  await fs.mkdir(kbStoreDir(repoRoot), { recursive: true });
}

export async function writeSerializedVectors(
  repoRoot: string,
  rows: SerializedMemoryVector[],
): Promise<void> {
  await ensureKbStoreDir(repoRoot);
  await fs.writeFile(
    vectorsPath(repoRoot),
    `${JSON.stringify(rows, null, 2)}\n`,
    "utf8",
  );
}

export async function writeManifest(
  repoRoot: string,
  manifest: KbManifestV1,
): Promise<void> {
  await ensureKbStoreDir(repoRoot);
  await fs.writeFile(
    manifestPath(repoRoot),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

function uniqueSources(rows: SerializedMemoryVector[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const s = row.metadata?.source;
    if (typeof s === "string" && s.length > 0) {
      set.add(s);
    }
  }
  return [...set].sort();
}

/** 从磁盘恢复 MemoryVectorStore（不重新嵌入已有向量）。 */
export async function memoryStoreFromSerialized(
  embeddings: EmbeddingsInterface,
  existing: SerializedMemoryVector[],
): Promise<MemoryVectorStore> {
  const store = await MemoryVectorStore.fromExistingIndex(embeddings);
  if (existing.length === 0) {
    return store;
  }
  const vectors = existing.map((r) => r.embedding);
  const documents = existing.map(
    (r) =>
      new Document({
        pageContent: r.content,
        metadata: { ...r.metadata },
        id: r.id,
      }),
  );
  await store.addVectors(vectors, documents);
  return store;
}

/**
 * 默认策略：同一 `metadata.source` 的旧块先删再写入新块，避免重复。
 * 若无须保留的旧向量，使用 `MemoryVectorStore.fromDocuments` 一次性嵌入新块。
 */
export async function replaceSourceAndEmbedNew(
  embeddings: EmbeddingsInterface,
  existingRows: SerializedMemoryVector[],
  sourceKey: string,
  newChunks: Document[],
): Promise<{ rows: SerializedMemoryVector[]; newChunkCount: number }> {
  const kept = existingRows.filter((row) => row.metadata?.source !== sourceKey);
  let store: MemoryVectorStore;
  if (kept.length === 0) {
    store = await MemoryVectorStore.fromDocuments(newChunks, embeddings);
  } else {
    store = await memoryStoreFromSerialized(embeddings, kept);
    await store.addDocuments(newChunks);
  }
  const rows: SerializedMemoryVector[] = store.memoryVectors.map((v) => ({
    content: v.content,
    embedding: v.embedding,
    metadata: { ...v.metadata },
    id: v.id,
  }));
  return { rows, newChunkCount: newChunks.length };
}

export function buildManifest(
  embeddingModel: string,
  rows: SerializedMemoryVector[],
  lastIngest: KbManifestV1["lastIngest"],
): KbManifestV1 {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    embeddingModel,
    totalChunks: rows.length,
    sources: uniqueSources(rows),
    lastIngest,
  };
}

/** 若 kb_store 中记录的 embedding 模型与当前不一致，避免混用维度。 */
export function assertEmbeddingModelCompatible(
  manifest: KbManifestV1 | null,
  currentModel: string,
): void {
  if (!manifest) {
    return;
  }
  if (manifest.embeddingModel && manifest.embeddingModel !== currentModel) {
    throw new Error(
      `kb_store 中记录的向量模型为「${manifest.embeddingModel}」，与当前 ARK_EMBED_MODEL「${currentModel}」不一致。请删除 kb_store 下的 ${VECTORS_FILENAME} / ${MANIFEST_FILENAME} 后重新 ingest，或改回同一模型。`,
    );
  }
}
