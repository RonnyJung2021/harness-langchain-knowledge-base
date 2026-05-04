import type { RagTurnDeps } from "../chat/ragTurn.js";
import type { InMemorySessionStore } from "../chat/sessionStore.js";
import type { ArkEnvConfig } from "../config.js";

export type ChatServerContext = {
  sessionStore: InMemorySessionStore;
  ragTurnDeps: RagTurnDeps;
  enqueueSession: <T>(sessionId: string, fn: () => Promise<T>) => Promise<T>;
  repoRoot: string;
  arkConfig: ArkEnvConfig;
  /** 全局串行：替换 KB + 热加载向量，避免并发写 kb_store */
  enqueueKbReplace: <T>(fn: () => Promise<T>) => Promise<T>;
};
