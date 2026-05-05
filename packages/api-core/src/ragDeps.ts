import type { RuntimeMode } from "@kb-rag/shared";
import { createAiChatInference } from "./ai/factory.js";
import { parseAiRuntimeMode } from "./ai/mode.js";
import { buildDefaultRagSystemPrompt } from "./chat/ragFormatting.js";
import type { KbRagLoadedContext } from "./chat/loadKbRagContext.js";
import type { RagTurnDeps } from "./chat/ragTurn.js";
import type { InferenceProvider } from "./providers/types.js";

function defaultInference(mode: RuntimeMode): InferenceProvider {
  return createAiChatInference(mode);
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
 * 从环境变量解析 `AI_RUNTIME_MODE`（回退 `RUNTIME_MODE`）后构造 {@link RagTurnDeps}。
 */
export function createRagDepsFromEnv(env: NodeJS.ProcessEnv, loaded: KbRagLoadedContext): RagTurnDeps {
  const mode = parseAiRuntimeMode(env);
  return createRagDeps({ mode, loaded });
}
