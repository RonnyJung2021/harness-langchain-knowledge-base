import { parseRuntimeMode, type RuntimeMode } from "@kb-rag/shared";
import { buildDefaultRagSystemPrompt } from "./chat/ragFormatting.js";
import type { KbRagLoadedContext } from "./chat/loadKbRagContext.js";
import type { RagTurnDeps } from "./chat/ragTurn.js";
import { OfflineStubInferenceProvider } from "./providers/offline/stubInference.js";
import type { InferenceProvider } from "./providers/types.js";
import { VolcanoArkChatProvider } from "./providers/volcano/VolcanoArkChatProvider.js";

function defaultInference(mode: RuntimeMode): InferenceProvider {
  return mode === "online" ? new VolcanoArkChatProvider() : new OfflineStubInferenceProvider();
}

/**
 * 由已加载的 KB 上下文构造 {@link RagTurnDeps}。
 */
export function createRagDeps(params: {
  loaded: KbRagLoadedContext;
  mode: RuntimeMode;
  providers?: { inference?: InferenceProvider };
}): RagTurnDeps {
  const { loaded, providers, mode } = params;
  const inference = providers?.inference ?? defaultInference(mode);
  return {
    embeddings: loaded.embeddings,
    vectorStore: loaded.vectorStore,
    ragConfig: loaded.ragCfg,
    inference,
    buildSystemPrompt: buildDefaultRagSystemPrompt,
  };
}

/**
 * 从环境变量解析 `RUNTIME_MODE` 后构造 {@link RagTurnDeps}。
 */
export function createRagDepsFromEnv(env: NodeJS.ProcessEnv, loaded: KbRagLoadedContext): RagTurnDeps {
  const mode = parseRuntimeMode(env.RUNTIME_MODE);
  return createRagDeps({ mode, loaded });
}
