/**
 * 判断是否为「网络 / 方舟侧超时」类错误，用于映射为 HTTP 504。
 * 不依赖具体 SDK 类型名，兼容 LangChain / fetch / undici 的 cause 链。
 */
export function isLikelyArkOrNetworkTimeout(err: unknown): boolean {
  let cur: unknown = err;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 8 && cur !== null && cur !== undefined; depth += 1) {
    if (seen.has(cur)) {
      break;
    }
    seen.add(cur);
    if (typeof cur !== "object") {
      break;
    }
    const o = cur as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.toLowerCase() : "";
    const msg = typeof o.message === "string" ? o.message.toLowerCase() : "";
    const code = typeof o.code === "string" ? o.code : "";
    if (name === "aborterror" || code === "ETIMEDOUT") {
      return true;
    }
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted")) {
      return true;
    }
    if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
      return true;
    }
    cur = o.cause;
  }
  return false;
}
