import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 自本文件位置向上查找 `pnpm-workspace.yaml`，得到单调仓库根目录。
 * 与 `@kb-rag/api-core` 的 `getRepoRoot` 逻辑一致，但不依赖 api-core（须先于其它 import 执行）。
 */
function findRepoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "loadRootEnv：自 apps/server 向上未找到 pnpm-workspace.yaml，无法在仓库根加载 .env",
      );
    }
    dir = parent;
  }
}

const repoRoot = findRepoRoot();
config({ path: path.join(repoRoot, ".env") });
/** 允许在 `apps/server/.env` 覆盖同名键（例如部署机专用变量） */
config({ path: path.join(process.cwd(), ".env"), override: true });
