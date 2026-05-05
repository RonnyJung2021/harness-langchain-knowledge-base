/**
 * 规范化 API 根路径（无末尾 `/`）。
 * @param raw 例如 `http://127.0.0.1:8787` 或空字符串表示同源相对路径
 */
export function normalizeApiBaseUrl(raw: string): string {
  const t = raw.trim();
  if (t === "") {
    return "";
  }
  return t.replace(/\/+$/, "");
}

/** 拼接 `/v1/...` 路径；base 为空时返回以 `/` 开头的相对 URL（浏览器同源）。 */
export function joinApiPath(baseUrl: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const b = normalizeApiBaseUrl(baseUrl);
  if (b === "") {
    return p;
  }
  return `${b}${p}`;
}

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};
