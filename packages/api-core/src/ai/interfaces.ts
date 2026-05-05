import type { InferenceChatMessage } from "../providers/types.js";

/**
 * 方舟兼容的最小对话接口（在线实现为 ChatOpenAI；离线可为 HTTP 本地模型或占位）。
 */
export interface ArkLikeChat {
  chat(
    messages: InferenceChatMessage[],
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<{ content: string }>;

  chatStream?(
    messages: InferenceChatMessage[],
    options: {
      signal?: AbortSignal;
      onTokenDelta: (delta: string) => void;
    },
  ): Promise<{ content: string }>;
}

/** 方舟兼容嵌入：对应 LangChain `Embeddings.embedDocuments` / `embedQuery`。 */
export interface ArkLikeEmbeddings {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
