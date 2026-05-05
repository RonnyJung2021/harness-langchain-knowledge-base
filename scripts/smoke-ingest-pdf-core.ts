/**
 * 可选冒烟：不经 CLI argv，直接调用 `ingestPdfFromAbsolutePath`。
 * 用法：pnpm ingest:core-smoke -- pdfs/sample.pdf
 * 在线模式需 ARK_*；离线模式设 AI_RUNTIME_MODE=offline（或 RUNTIME_MODE=offline）。
 */
import "dotenv/config";
import path from "node:path";
import process from "node:process";
import {
  getRepoRoot,
  ingestPdfFromAbsolutePath,
  parseAiRuntimeMode,
  readManifest,
  readSerializedVectors,
  resolveEmbeddingForIngest,
} from "@kb-rag/api-core";

function resolvePdfPath(repoRoot: string, userPath: string): string {
  const abs = path.isAbsolute(userPath)
    ? path.resolve(userPath)
    : path.resolve(repoRoot, userPath);
  const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
  if (rel.startsWith("..")) {
    throw new Error("PDF 路径须位于仓库根目录之下。");
  }
  return abs;
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2).filter((a) => a !== "--").join(" ").trim();
  if (raw === "") {
    console.error("用法：pnpm ingest:core-smoke -- pdfs/sample.pdf");
    process.exitCode = 1;
    return;
  }
  const repoRoot = getRepoRoot();
  const absPdf = resolvePdfPath(repoRoot, raw);
  const mode = parseAiRuntimeMode(process.env);
  const existingRows = await readSerializedVectors(repoRoot);
  const manifest = await readManifest(repoRoot);
  const { provider, manifestEmbeddingModel } = resolveEmbeddingForIngest(mode, existingRows);
  const skipEmbeddingModelIdCheck =
    mode === "offline" &&
    manifest !== null &&
    manifest.embeddingModel !== manifestEmbeddingModel;

  const out = await ingestPdfFromAbsolutePath({
    repoRoot,
    absPdfPath: absPdf,
    embeddingProvider: provider,
    manifestEmbeddingModel,
    skipEmbeddingModelIdCheck,
  });
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
