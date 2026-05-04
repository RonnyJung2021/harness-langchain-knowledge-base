/**
 * 可选冒烟：不经 CLI argv，直接调用 `ingestPdfFromAbsolutePath`（需 .env 与方舟可用）。
 * 用法：pnpm ingest:core-smoke -- pdfs/sample.pdf
 */
import "dotenv/config";
import path from "node:path";
import process from "node:process";
import { loadArkConfig } from "../src/config.js";
import { ingestPdfFromAbsolutePath } from "../src/ingestPdfFromAbsolutePath.js";
import { getRepoRoot } from "../src/paths/repoRoot.js";

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
  const cfg = loadArkConfig();
  const out = await ingestPdfFromAbsolutePath({
    repoRoot,
    absPdfPath: absPdf,
    arkConfig: cfg,
  });
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
