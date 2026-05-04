const DEFAULT_MAX = 8000;

export function readHttpChatMaxMessageChars(): number {
  const raw = process.env.HTTP_CHAT_MAX_MESSAGE_CHARS?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_MAX;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 1_000_000) {
    throw new Error(`无效 HTTP_CHAT_MAX_MESSAGE_CHARS：${raw}`);
  }
  return n;
}
