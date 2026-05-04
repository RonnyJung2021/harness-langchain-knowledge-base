import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadArkConfig } from "../config.js";
import {
  ingestPdfFromAbsolutePath,
  type IngestPdfFromAbsolutePathResult,
} from "../ingestPdfFromAbsolutePath.js";
import { getRepoRoot } from "../paths/repoRoot.js";

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

  const arkConfig = loadArkConfig();
  try {
    return await ingestPdfFromAbsolutePath({
      repoRoot,
      absPdfPath,
      arkConfig,
    });
  } catch (e) {
    await fs.unlink(absPdfPath).catch(() => {});
    throw e;
  }
}
