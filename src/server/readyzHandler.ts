import fs from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";

/**
 * Readiness：轻量检查 `kb_store/manifest.json` 可读（不调用方舟，与 `/healthz` 区分）。
 */
export async function handleReadyz(repoRoot: string, req: Request, res: Response): Promise<void> {
  const manifestPath = path.join(repoRoot, "kb_store", "manifest.json");
  const requestId = typeof req.id === "string" ? req.id : "";
  try {
    const text = await fs.readFile(manifestPath, "utf8");
    if (text.trim().length === 0) {
      throw new Error("empty manifest");
    }
  } catch {
    res.status(503).json({
      ok: false,
      error: {
        code: "NOT_READY",
        message: "kb_store/manifest.json 不可读或为空；请先执行 pnpm ingest。",
        ...(requestId !== "" ? { requestId } : {}),
      },
      ts: new Date().toISOString(),
    });
    return;
  }
  res.status(200).json({
    ok: true,
    kbManifestReadable: true,
    ts: new Date().toISOString(),
    ...(requestId !== "" ? { requestId } : {}),
  });
}
