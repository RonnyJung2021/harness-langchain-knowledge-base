/** 隐藏可能出现在错误信息中的 Bearer token 片段 */
export function sanitizeForUi(text: string): string {
  return text.replace(/Bearer\s+\S+/gi, "Bearer [已隐藏]");
}

/**
 * 结合 HTTP 状态与业务 `error.code` 生成面向用户的短说明（中文）。
 */
export function describeHttpFailure(status: number, code?: string, rawMessage?: string): string {
  const hint =
    status === 401
      ? "鉴权失败：请检查 Bearer / HTTP_ADMIN_TOKEN 或 VITE_HTTP_ADMIN_TOKEN。"
      : status === 413
        ? "请求体过大：上传请缩小 PDF 或调大 KB_UPLOAD_MAX_BYTES；JSON 请调大 HTTP_JSON_BODY_MAX_BYTES。"
        : status === 415
          ? "内容类型不被接受：请确认上传为 PDF。"
          : status === 429
            ? "请求过于频繁（限流）：请稍后再试。"
            : status === 504
              ? "上游请求超时：请稍后重试；若频繁出现可检查网络或调大 ARK_REQUEST_TIMEOUT_MS。"
              : status === 502
                ? "上游服务异常（如方舟模型/嵌入）：请稍后重试或检查 ARK_* 配置。"
                : status >= 500
                  ? "服务端内部错误：请查看日志或联系运维。"
                  : status === 400
                    ? "请求参数有误。"
                    : status === 404
                      ? "资源不存在。"
                      : `请求失败（HTTP ${String(status)}）。`;

  const parts = [hint];
  if (code !== undefined && code !== "") {
    parts.push(`错误码：${code}`);
  }
  if (rawMessage !== undefined && rawMessage.trim() !== "") {
    parts.push(`详情：${sanitizeForUi(rawMessage.trim())}`);
  }
  return parts.join(" ");
}
