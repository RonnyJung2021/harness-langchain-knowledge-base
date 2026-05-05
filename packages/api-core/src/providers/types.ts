/**
 * 与模型推理交互的最小消息形状（不含会话 id / 时间戳）。
 */
export type InferenceChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface EmbeddingProvider {
  embedTexts(texts: string[]): Promise<number[][]>;
}

export interface InferenceProvider {
  chat(
    messages: InferenceChatMessage[],
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<{
    content: string;
  }>;
  /**
   * 可选流式：与 {@link chat} 语义一致，按增量回调 token。
   * 未实现时 {@link runRagChatTurnStream} 将退回为非流式 {@link chat} 并一次性回调全文。
   */
  chatStream?(
    messages: InferenceChatMessage[],
    options: {
      signal?: AbortSignal;
      onTokenDelta: (delta: string) => void;
    },
  ): Promise<{
    content: string;
  }>;
}
