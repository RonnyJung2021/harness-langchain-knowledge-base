import type {
  AiRuntimeInfoPayload,
  ArkEnvConfig,
  InMemorySessionStore,
  RagTurnDeps,
} from "@kb-rag/api-core";
import type { RuntimeMode } from "@kb-rag/shared";

export type ChatServerContext = {
  sessionStore: InMemorySessionStore;
  ragTurnDeps: RagTurnDeps;
  enqueueSession: <T>(sessionId: string, fn: () => Promise<T>) => Promise<T>;
  repoRoot: string;
  arkConfig: ArkEnvConfig;
  /** 全局串行：替换 KB + 热加载向量，避免并发写 kb_store */
  enqueueKbReplace: <T>(fn: () => Promise<T>) => Promise<T>;
  /** 与 `AI_RUNTIME_MODE`（回退 `RUNTIME_MODE`）对齐，供 `/v1/runtime` 与多端展示 */
  runtimeMode: RuntimeMode;
  /** 供 `GET /v1/runtime-info`：模式与能力（不含密钥） */
  runtimeInfo: AiRuntimeInfoPayload;
};
