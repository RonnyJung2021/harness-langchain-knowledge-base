/**
 * 离线模式下配置了本地 HTTP 对话但不可达，或强制要求本地对话但未配置 URL。
 * HTTP 层应映射为 **503** 与稳定业务码（勿泄漏密钥）。
 */
export class OfflineModelUnavailableError extends Error {
  readonly bizCode = "OFFLINE_CHAT_UNAVAILABLE" as const;

  constructor(
    message = "离线模型未启动或不可达：请检查 LOCAL_CHAT_BASE_URL 与本机推理服务（如 Ollama / llama.cpp OpenAI 兼容接口）是否已启动。",
  ) {
    super(message);
    this.name = "OfflineModelUnavailableError";
  }
}
