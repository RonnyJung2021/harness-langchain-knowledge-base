import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  getRepoRoot,
  kbStoreDir,
  manifestPath,
  readManifest,
  vectorsPath,
} from "@kb-rag/api-core";

const SMOKE_REL = path.join("pdfs", "_smoke.pdf");

async function fileSize(p: string): Promise<number> {
  const st = await fs.stat(p);
  return st.size;
}

async function ensureSmokePdf(repoRoot: string): Promise<string> {
  const out = path.join(repoRoot, SMOKE_REL);
  try {
    await fs.access(out);
    return out;
  } catch {
    await fs.mkdir(path.dirname(out), { recursive: true });
    const py = path.join(repoRoot, "scripts", "gen-smoke-pdf.py");
    const r = spawnSync(process.env.PYTHON ?? "python3", [py, out], {
      encoding: "utf8",
      cwd: repoRoot,
    });
    if (r.status !== 0) {
      throw new Error(
        `无法生成 ${SMOKE_REL}：请安装 Python 3 与 reportlab（pip install reportlab）。\n${r.stderr || r.stdout || ""}`,
      );
    }
    return out;
  }
}

function runIngest(repoRoot: string): void {
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const ingestTs = path.join(repoRoot, "packages", "api-core", "src", "ingest.ts");
  const r = spawnSync(process.execPath, [tsxCli, ingestTs, "--", SMOKE_REL], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

async function main(): Promise<void> {
  const repoRoot = getRepoRoot();
  await ensureSmokePdf(repoRoot);
  runIngest(repoRoot);

  const vFile = vectorsPath(repoRoot);
  const mFile = manifestPath(repoRoot);
  const vBytes = await fileSize(vFile).catch(() => 0);
  const mBytes = await fileSize(mFile).catch(() => 0);
  const manifest = await readManifest(repoRoot);
  const chunk =
    manifest?.lastIngest?.chunkCount ??
    (await (async () => {
      try {
        const raw = await fs.readFile(vFile, "utf8");
        const arr = JSON.parse(raw) as unknown;
        return Array.isArray(arr) ? arr.length : 0;
      } catch {
        return 0;
      }
    })());

  console.log("\n--- ingest:smoke 验收 ---");
  console.log(`kb_store 目录: ${kbStoreDir(repoRoot)}`);
  console.log(`vectors.json 大小: ${vBytes} bytes`);
  console.log(`manifest.json 大小: ${mBytes} bytes`);
  console.log(`chunk 数（优先 manifest.lastIngest）: ${chunk}`);

  if (chunk <= 0) {
    console.error("断言失败：chunk 数须 > 0");
    process.exit(1);
  }
  console.log("断言通过：chunk > 0");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
