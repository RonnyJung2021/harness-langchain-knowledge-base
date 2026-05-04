import "dotenv/config";

export type ChatContextLimits = {
  /**
   * 参与模型调用的最近消息条数，**仅统计** `user` 与 `assistant`（不含本轮 `userText`，也不计 `system`）。
   */
  maxHistoryMessages: number;
  /** 【参考资料】正文拼接后的总字符上限（不含 system 中规则文案部分，仅对检索拼接块裁剪）。 */
  ragContextMaxChars: number;
};

const DEFAULT_MAX_HISTORY_MESSAGES = 20;
const DEFAULT_RAG_CONTEXT_MAX_CHARS = 12_000;

export function loadChatContextLimits(): ChatContextLimits {
  const k = Number.parseInt(
    process.env.ARK_CHAT_MAX_HISTORY_MESSAGES ?? String(DEFAULT_MAX_HISTORY_MESSAGES),
    10,
  );
  const maxHistoryMessages =
    Number.isFinite(k) && k > 0 ? k : DEFAULT_MAX_HISTORY_MESSAGES;

  const c = Number.parseInt(
    process.env.ARK_RAG_CONTEXT_MAX_CHARS ?? String(DEFAULT_RAG_CONTEXT_MAX_CHARS),
    10,
  );
  const ragContextMaxChars =
    Number.isFinite(c) && c > 0 ? c : DEFAULT_RAG_CONTEXT_MAX_CHARS;

  return { maxHistoryMessages, ragContextMaxChars };
}
