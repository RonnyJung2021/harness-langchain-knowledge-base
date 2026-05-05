/**
 * 方舟相关类型与加载入口统一由 `providers/volcano/arkEnv` 提供；
 * 此处再导出以保持历史 import 路径 `@kb-rag/api-core` → `./config.js` 兼容。
 */
export type { ArkEmbedInputMode, ArkEnvConfig } from "./providers/volcano/arkEnv.js";
export {
  loadVolcanoArkEnvConfig,
  readArkRequestTimeoutMs,
} from "./providers/volcano/arkEnv.js";

/** 与历史代码兼容：`loadArkConfig` ≡ {@link loadVolcanoArkEnvConfig}（在线路径读取 ARK_*） */
export { loadVolcanoArkEnvConfig as loadArkConfig } from "./providers/volcano/arkEnv.js";
