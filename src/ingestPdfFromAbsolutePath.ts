import fs from "node:fs/promises";
import path from "node:path";
import type { ArkEnvConfig } from "./config.js";
import { splitDocumentsToChunks } from "./chunk/split.js";
import { createArkEmbeddings } from "./embed/arkEmbeddings.js";
import { loadPdfDocuments } from "./pdf/loadPdf.js";
import {
  assertEmbeddingModelCompatible,
  buildManifest,
  readManifest,
  readSerializedVectors,
  replaceSourceAndEmbedNew,
  manifestPath,
  vectorsPath,
  writeManifest,
  writeSerializedVectors,
} from "./store/localVectorStore.js";

export type IngestPdfFromAbsolutePathArgs = {
  repoRoot: string;
  /** 已解析的绝对路径，且须位于 `repoRoot` 之下（与 CLI `resolvePdfPath` 一致）。 */
  absPdfPath: string;
  arkConfig: ArkEnvConfig;
};

export type IngestPdfFromAbsolutePathResult = {
  sourceKey: string;
  chunkCount: number;
  durationMs: number;
  vectorsPath: string;
  manifestPath: string;
};

/**
 * 从仓库内 PDF 绝对路径完成：读 PDF → 切分 → 嵌入 → 写 `kb_store` 向量与 manifest（与 `replaceSourceAndEmbedNew` 行为一致）。
 */
export async function ingestPdfFromAbsolutePath(
  args: IngestPdfFromAbsolutePathArgs,
): Promise<IngestPdfFromAbsolutePathResult> {
  const { repoRoot, absPdfPath, arkConfig } = args;
  const t0 = Date.now();

  await fs.access(absPdfPath).catch(() => {
    throw new Error(`找不到 PDF 文件：${absPdfPath}`);
  });

  const rel = path.relative(repoRoot, absPdfPath).split(path.sep).join("/");
  if (rel.startsWith("..") || rel === "") {
    throw new Error("PDF 路径须位于仓库根目录之下。");
  }
  const sourceKey = rel;

  const embeddings = createArkEmbeddings(arkConfig);
  const manifest = await readManifest(repoRoot);
  assertEmbeddingModelCompatible(manifest, arkConfig.embedModel);

  const pdfDocs = await loadPdfDocuments(absPdfPath);
  for (const d of pdfDocs) {
    d.metadata = { ...d.metadata, source: sourceKey };
  }

  const chunks = await splitDocumentsToChunks(pdfDocs);
  chunks.forEach((doc, i) => {
    doc.metadata = { ...doc.metadata, chunkIndex: i };
  });

  const existing = await readSerializedVectors(repoRoot);
  if (chunks.length === 0) {
    throw new Error("切分后未得到任何文本块，请检查 PDF 内容或调大 chunk 参数。");
  }

  const { rows: serializedRows } = await replaceSourceAndEmbedNew(
    embeddings,
    existing,
    sourceKey,
    chunks,
  );

  await writeSerializedVectors(repoRoot, serializedRows);

  const durationMs = Date.now() - t0;
  const manifestOut = buildManifest(arkConfig.embedModel, serializedRows, {
    source: sourceKey,
    chunkCount: chunks.length,
    durationMs,
  });
  await writeManifest(repoRoot, manifestOut);

  return {
    sourceKey,
    chunkCount: chunks.length,
    durationMs,
    vectorsPath: vectorsPath(repoRoot),
    manifestPath: manifestPath(repoRoot),
  };
}
