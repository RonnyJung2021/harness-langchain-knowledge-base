import path from "node:path";
import { fileURLToPath } from "node:url";

/** 仓库根目录（含 package.json 的目录），用于解析相对 PDF 路径与 kb_store。 */
export function getRepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}
