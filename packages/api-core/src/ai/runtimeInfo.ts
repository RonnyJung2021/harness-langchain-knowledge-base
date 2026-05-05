import type { AiRuntimeMode } from "./mode.js";

export type AiRuntimeCapabilities = {
  chat: boolean;
  embeddings: boolean;
};

export type AiRuntimeInfoPayload = {
  mode: AiRuntimeMode;
  capabilities: AiRuntimeCapabilities;
};

/**
 * 供 **`GET /v1/runtime-info`**：不返回密钥，仅模式与能力布尔值。
 * - **online**：`ARK_API_KEY` 非空则认为 chat/embeddings 可用（启动阶段仍会校验，运行时失败另报）。
 * - **offline**：嵌入占位始终视为可用；若 **`LOCAL_CHAT_REQUIRE=1`** 且未配置 **`LOCAL_CHAT_BASE_URL`**，则 `chat` 为 false。
 */
export function computeAiRuntimeInfo(env: NodeJS.ProcessEnv, mode: AiRuntimeMode): AiRuntimeInfoPayload {
  if (mode === "online") {
    const ok = Boolean(env.ARK_API_KEY?.trim());
    return {
      mode,
      capabilities: { chat: ok, embeddings: ok },
    };
  }
  const requireLocal =
    env.LOCAL_CHAT_REQUIRE?.trim() === "1" || env.LOCAL_CHAT_REQUIRE?.trim().toLowerCase() === "true";
  const hasUrl = Boolean(env.LOCAL_CHAT_BASE_URL?.trim());
  const chatCap = !requireLocal || hasUrl;
  return {
    mode: "offline",
    capabilities: { chat: chatCap, embeddings: true },
  };
}
