import type { CorsOptions } from "cors";

const DEFAULT_DEV_ORIGIN = "http://127.0.0.1:5173";

/**
 * `HTTP_CORS_ORIGINS`：逗号分隔的 Origin 白名单。
 * - 已设置（非空）：仅允许列表中的 Origin；无 `Origin` 头的请求（如 curl、同源）仍由 `cors` 正常放行。
 * - 未设置且 `NODE_ENV === "production"`：不发送 CORS 头（`origin: false`），建议依赖同源静态资源或网关。
 * - 未设置且非 production：默认 `http://127.0.0.1:5173`，便于 Vite 开发代理联调。
 */
export function buildCorsOptions(): CorsOptions {
  const raw = process.env.HTTP_CORS_ORIGINS?.trim();
  if (raw !== undefined && raw !== "") {
    const list = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length === 0) {
      return { origin: false };
    }
    if (list.length === 1) {
      return { origin: list[0] };
    }
    return { origin: list };
  }
  if (process.env.NODE_ENV === "production") {
    return { origin: false };
  }
  return { origin: DEFAULT_DEV_ORIGIN };
}
