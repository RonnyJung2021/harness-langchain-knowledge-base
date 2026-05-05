import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 单调仓库根目录（存在 `pnpm-workspace.yaml` 的目录）。
 * 用于解析相对 PDF 路径、`kb_store`、`sessions` 等。
 */
export function getRepoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const ws = path.join(dir, "pnpm-workspace.yaml");
    if (fs.existsSync(ws)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("getRepoRoot：自 api-core 源码位置向上未找到 pnpm-workspace.yaml");
    }
    dir = parent;
  }
}
