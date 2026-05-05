import { sanitizeForUi } from "../httpFeedback.js";

/** Web（空 base）与 Native 共用的 Base URL 展示文案；不输出查询串与密码。 */
export function formatDiagnosticsApiBaseUrl(apiBaseUrl: string): string {
  const t = apiBaseUrl.trim();
  if (t === "") {
    return "同源（相对路径 / 当前页面 Origin）";
  }
  try {
    const u = new URL(t);
    const auth =
      u.username !== ""
        ? `${sanitizeForUi(u.username)}:***@`
        : "";
    const origin = `${u.protocol}//${auth}${u.host}`;
    const path = u.pathname;
    if (path === "" || path === "/") {
      return origin;
    }
    const short = path.length > 64 ? `${path.slice(0, 64)}…` : path;
    return `${origin}${short}`;
  } catch {
    const slice = t.length > 96 ? `${t.slice(0, 96)}…` : t;
    return `（URL 不可解析）${sanitizeForUi(slice)}`;
  }
}

export type ParsedHttpDetail = {
  detail: string;
  bizCode?: string;
};

/** 从响应体提取 `error.code` / `error.message` 与人可读摘要（限长）。 */
export function parseHttpBodyForDiagnostics(text: string, maxLen = 320): ParsedHttpDetail {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { detail: "（空响应体）" };
  }
  try {
    const j = JSON.parse(trimmed) as {
      error?: { code?: unknown; message?: unknown };
      mode?: unknown;
      capabilities?: unknown;
    };
    const code =
      j.error !== undefined &&
      typeof j.error === "object" &&
      j.error !== null &&
      typeof j.error.code === "string"
        ? j.error.code
        : undefined;
    const msg =
      j.error !== undefined &&
      typeof j.error === "object" &&
      j.error !== null &&
      typeof j.error.message === "string"
        ? j.error.message
        : undefined;
    if (code !== undefined || msg !== undefined) {
      const parts = [
        code !== undefined ? `error.code=${sanitizeForUi(code)}` : "",
        msg !== undefined ? sanitizeForUi(msg) : "",
      ].filter((s) => s.length > 0);
      return {
        bizCode: code,
        detail: sanitizeForUi(parts.join(" · ").slice(0, maxLen)),
      };
    }
    /** runtime-info 等成功 JSON */
    const snippet = sanitizeForUi(trimmed.slice(0, maxLen));
    return { detail: snippet };
  } catch {
    return { detail: sanitizeForUi(trimmed.slice(0, maxLen)) };
  }
}
