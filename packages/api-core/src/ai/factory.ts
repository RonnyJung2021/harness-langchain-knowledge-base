import type { AiRuntimeMode } from "./mode.js";
import type { ArkLikeChat, ArkLikeEmbeddings } from "./interfaces.js";
import { embeddingProviderAsArkLike, inferenceProviderAsArkLike } from "./adapters.js";
import { OfflineStubEmbeddingProvider } from "../providers/offline/stubEmbedding.js";
import { OfflineStubInferenceProvider } from "../providers/offline/stubInference.js";
import type { InferenceProvider } from "../providers/types.js";
import { OFFLINE_EMBEDDING_MODEL } from "../providers/constants.js";
import { VolcanoArkChatProvider } from "../providers/volcano/VolcanoArkChatProvider.js";
import { VolcanoArkEmbeddingProvider } from "../providers/volcano/VolcanoArkEmbeddingProvider.js";
import { HttpLocalChatProvider } from "./local/httpLocalChat.js";
import { OfflineChatRequiredButMissingProvider } from "./local/requiredButMissingChat.js";

function parseOfflineStubEmbedDimFromEnv(): number {
  const raw = process.env.OFFLINE_STUB_EMBED_DIM?.trim();
  if (raw === undefined || raw === "") {
    return 1024;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 8 || n > 8192) {
    return 1024;
  }
  return n;
}

function localChatInferenceProvider(): InferenceProvider {
  const requireLocal =
    process.env.LOCAL_CHAT_REQUIRE?.trim() === "1" ||
    process.env.LOCAL_CHAT_REQUIRE?.trim().toLowerCase() === "true";
  const base = process.env.LOCAL_CHAT_BASE_URL?.trim();
  if (requireLocal && (base === undefined || base === "")) {
    return new OfflineChatRequiredButMissingProvider();
  }
  if (base !== undefined && base !== "") {
    return new HttpLocalChatProvider(base);
  }
  return new OfflineStubInferenceProvider();
}

export type AiDeps = {
  mode: AiRuntimeMode;
  chat: ArkLikeChat;
  embeddings: ArkLikeEmbeddings;
  /** 写入 manifest / 与 kb_store 对齐的嵌入模型标识 */
  manifestEmbeddingModelId: string;
};

export type CreateAiDepsOptions = {
  /** 离线占位向量维度；缺省时用环境变量或默认 1024 */
  offlineEmbedDimensions?: number;
};

/**
 * 统一构造方舟兼容 {@link ArkLikeChat} / {@link ArkLikeEmbeddings}。
 * - **online**：嵌入与对话均经火山方舟（`ARK_*`，内部可使用 `@langchain/openai`）。
 * - **offline**：嵌入默认为确定性哈希伪向量（效果弱，仅本地闭环）；对话为占位或 **`LOCAL_CHAT_BASE_URL`** OpenAI 兼容 HTTP。
 */
export function createAiDeps(mode: AiRuntimeMode, opts?: CreateAiDepsOptions): AiDeps {
  if (mode === "online") {
    const volcEmb = new VolcanoArkEmbeddingProvider();
    const chat = new VolcanoArkChatProvider();
    return {
      mode,
      chat: inferenceProviderAsArkLike(chat),
      embeddings: embeddingProviderAsArkLike(volcEmb),
      manifestEmbeddingModelId: volcEmb.manifestEmbeddingModelId,
    };
  }

  const dim = opts?.offlineEmbedDimensions ?? parseOfflineStubEmbedDimFromEnv();
  const stubEmb = new OfflineStubEmbeddingProvider(dim);
  const chatInf = localChatInferenceProvider();
  return {
    mode,
    chat: inferenceProviderAsArkLike(chatInf),
    embeddings: embeddingProviderAsArkLike(stubEmb),
    manifestEmbeddingModelId: OFFLINE_EMBEDDING_MODEL,
  };
}

/** 仅构造对话 Provider（RAG 检索嵌入来自已加载 kb_store，避免重复构造在线嵌入客户端）。 */
export function createAiChatInference(mode: AiRuntimeMode): InferenceProvider {
  if (mode === "online") {
    return new VolcanoArkChatProvider();
  }
  return localChatInferenceProvider();
}
