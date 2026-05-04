import fs from "node:fs/promises";
import path from "node:path";
import { loadArkConfig } from "./config.js";
import { splitDocumentsToChunks } from "./chunk/split.js";
import { createArkEmbeddings } from "./embed/arkEmbeddings.js";
import { getRepoRoot } from "./paths/repoRoot.js";
import { loadPdfDocuments } from "./pdf/loadPdf.js";
import {
  assertEmbeddingModelCompatible,
  buildManifest,
  readManifest,
  readSerializedVectors,
  replaceSourceAndEmbedNew,
  vectorsPath,
  manifestPath,
  writeManifest,
  writeSerializedVectors,
} from "./store/localVectorStore.js";

function parsePdfPathFromArgv(): string {
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  const scriptIdx = raw.findIndex(
    (a) => a.endsWith(`${path.sep}ingest.ts`) || a.endsWith("/ingest.ts"),
  );
  const rest = scriptIdx >= 0 ? raw.slice(scriptIdx + 1) : raw;
  const joined = rest.join(" ").trim();
  if (!joined) {
    throw new Error("请传入 PDF 路径，例如：pnpm ingest -- pdfs/sample.pdf");
  }
  return joined;
}

function resolvePdfPath(repoRoot: string, userPath: string): string {
  const abs = path.isAbsolute(userPath)
    ? path.resolve(userPath)
    : path.resolve(repoRoot, userPath);
  const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
  if (rel.startsWith("..")) {
    throw new Error(
      "PDF 路径须位于仓库根目录之下（相对路径相对仓库根目录解析；请勿使用指向仓库外的绝对路径）。",
    );
  }
  return abs;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const repoRoot = getRepoRoot();
  const userArg = parsePdfPathFromArgv();
  const absPdf = resolvePdfPath(repoRoot, userArg);

  await fs.access(absPdf).catch(() => {
    throw new Error(`找不到 PDF 文件：${absPdf}`);
  });

  const sourceKey = path.relative(repoRoot, absPdf).split(path.sep).join("/");
  const cfg = loadArkConfig();
  const embeddings = createArkEmbeddings(cfg);

  const manifest = await readManifest(repoRoot);
  assertEmbeddingModelCompatible(manifest, cfg.embedModel);

  const pdfDocs = await loadPdfDocuments(absPdf);
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
  const manifestOut = buildManifest(cfg.embedModel, serializedRows, {
    source: sourceKey,
    chunkCount: chunks.length,
    durationMs,
  });
  await writeManifest(repoRoot, manifestOut);

  const vPath = vectorsPath(repoRoot);
  const mPath = manifestPath(repoRoot);
  console.log(`块数量：${chunks.length}`);
  console.log(`耗时：${durationMs} ms`);
  console.log(`向量与元数据已写入：\n  ${vPath}\n  ${mPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
