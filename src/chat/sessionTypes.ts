/**
 * 对话角色。
 * `system` 通常由服务端在拼接 LLM 消息时注入；客户端会话历史可不包含该角色。
 */
export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  /** ISO 8601 时间戳 */
  createdAt: string;
};

/**
 * 与单轮 ask CLI 打印的「文件名、块序号、相似度、前 80 字预览」对齐的结构化引用摘要，
 * 便于后续 JSON API 直接序列化。
 */
export type CitationSummary = {
  /** 从 1 开始的引用序号，与 CLI `[n]` 一致 */
  index: number;
  sourceFile: string;
  chunkIndex: number | string;
  score: number;
  /** 已折叠空白并截断至 80 字符的正文预览 */
  preview80: string;
};

export type RagTurnInput = {
  userText: string;
  sessionId: string;
  history: ChatMessage[];
};

export type RagTurnOutput = {
  assistantText: string;
  citations: CitationSummary[];
  degraded?: boolean;
};
