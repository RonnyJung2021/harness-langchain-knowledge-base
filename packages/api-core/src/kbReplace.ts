import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parseRuntimeMode } from "@kb-rag/shared";
import {
  ingestPdfFromAbsolutePath,
  type IngestPdfFromAbsolutePathResult,
} from "./ingestPdfFromAbsolutePath.js";
import { getRepoRoot } from "./paths/repoRoot.js";
import { resolveEmbeddingForIngest } from "./providers/resolveEmbedding.js";
import { readManifest, readSerializedVectors } from "./store/localVectorStore.js";

export type ReplaceKnowledgeBaseFromUploadedFileParams = {
  /** PDF 原始字节 */
  uploadBytes: Uint8Array;
};

/**
 * 将上传文件写入 `kb_uploads/<uuid>.pdf` 后执行与 `pnpm ingest` 相同的入库流程。
 * 成功时保留上传文件；失败时尝试删除临时 PDF。
 */
export async function replaceKnowledgeBaseFromUploadedFile(
  params: ReplaceKnowledgeBaseFromUploadedFileParams,
): Promise<IngestPdfFromAbsolutePathResult> {
  const repoRoot = getRepoRoot();
  const id = randomUUID();
  const uploadsDir = path.join(repoRoot, "kb_uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const absPdfPath = path.join(uploadsDir, `${id}.pdf`);
  await fs.writeFile(absPdfPath, params.uploadBytes);

  const mode = parseRuntimeMode(process.env.RUNTIME_MODE);
  const manifest = await readManifest(repoRoot);
  const existingRows = await readSerializedVectors(repoRoot);
  const { provider, manifestEmbeddingModel } = resolveEmbeddingForIngest(mode, existingRows);

  const skipEmbeddingModelIdCheck =
    mode === "offline" &&
    manifest !== null &&
    manifest.embeddingModel !== manifestEmbeddingModel;

  try {
    return await ingestPdfFromAbsolutePath({
      repoRoot,
      absPdfPath,
      embeddingProvider: provider,
      manifestEmbeddingModel,
      skipEmbeddingModelIdCheck,
    });
  } catch (e) {
    await fs.unlink(absPdfPath).catch(() => {});
    throw e;
  }
}
