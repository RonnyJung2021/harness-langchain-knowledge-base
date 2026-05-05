import path from "node:path";
import { parseRuntimeMode } from "@kb-rag/shared";
import { ingestPdfFromAbsolutePath } from "./ingestPdfFromAbsolutePath.js";
import { getRepoRoot } from "./paths/repoRoot.js";
import { resolveEmbeddingForIngest } from "./providers/resolveEmbedding.js";
import { readManifest, readSerializedVectors } from "./store/localVectorStore.js";

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
  const repoRoot = getRepoRoot();
  const userArg = parsePdfPathFromArgv();
  const absPdf = resolvePdfPath(repoRoot, userArg);

  const mode = parseRuntimeMode(process.env.RUNTIME_MODE);
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

  console.log(`块数量：${out.chunkCount}`);
  console.log(`耗时：${out.durationMs} ms`);
  console.log(`向量与元数据已写入：\n  ${out.vectorsPath}\n  ${out.manifestPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
