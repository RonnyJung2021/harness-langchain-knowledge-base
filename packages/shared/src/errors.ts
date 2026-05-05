/**
 * 与 v3 REST / 服务端 HttpError 对齐的稳定错误码（用于客户端分支与文档）。
 * 非穷尽：服务端可能新增其它 code。
 */
export const KB_API_ERROR_CODES = [
  "NOT_FOUND",
  "INTERNAL",
  "PAYLOAD_TOO_LARGE",
  "NOT_READY",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "INVALID_MIME",
  "NO_FILE",
  "INVALID_BODY",
  "EMPTY_TEXT",
  "MESSAGE_TOO_LONG",
  "INVALID_SESSION_ID",
  "SESSION_NOT_FOUND",
  "ARK_TIMEOUT",
  "UPSTREAM",
  "VECTOR_RELOAD_FAILED",
] as const;

export type KbApiErrorCode = (typeof KB_API_ERROR_CODES)[number];
