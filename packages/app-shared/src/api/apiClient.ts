import { joinApiPath } from "@kb-rag/shared";

/**
 * 统一拼接 API 路径（供 {@link fetchJson} / 流式上传等使用）。
 *
 * - **Web 同源**：`apiBaseUrl` 传 `""`，得到 `/v1/...` 相对路径，由浏览器当前 Origin 解析。
 * - **React Native**：传入构建期注入的 `process.env.EXPO_PUBLIC_API_BASE_URL`（完整 `scheme://host:port`，无尾斜杠）。
 *
 * **禁止**把 **方舟密钥**、**HTTP_ADMIN_TOKEN** 等放进 `EXPO_PUBLIC_*`（仅服务端或非打包渠道保管）。
 */
export function resolveApiUrl(apiBaseUrl: string, path: string): string {
  return joinApiPath(apiBaseUrl.trim(), path);
}
