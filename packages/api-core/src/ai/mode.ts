import { parseRuntimeMode, type RuntimeMode } from "@kb-rag/shared";

/** 与方舟/本地推理切换对齐：`online` | `offline`（值域与 {@link RuntimeMode} 一致）。 */
export type AiRuntimeMode = RuntimeMode;

/**
 * 读取 `AI_RUNTIME_MODE`（默认 **online**）；未设置时回退到旧变量 **`RUNTIME_MODE`**。
 */
export function parseAiRuntimeMode(env: NodeJS.ProcessEnv): AiRuntimeMode {
  const raw = env.AI_RUNTIME_MODE?.trim().toLowerCase();
  if (raw === "offline" || raw === "online") {
    return raw;
  }
  return parseRuntimeMode(env.RUNTIME_MODE);
}
