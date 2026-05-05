import type { InferenceChatMessage, InferenceProvider } from "../../providers/types.js";
import { OfflineModelUnavailableError } from "../errors.js";

function readTimeoutMs(): number {
  const raw = process.env.LOCAL_CHAT_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === "") {
    return 120_000;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}

function isLikelyNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) {
    return true;
  }
  if (e instanceof Error) {
    return /fetch|ECONNREFUSED|ENOTFOUND|network|Failed to fetch/i.test(e.message);
  }
  return false;
}

/**
 * OpenAI 兼容 **`POST /v1/chat/completions`**（如 Ollama `http://127.0.0.1:11434/v1/chat/completions`、llama.cpp server）。
 * 模型名由 **`LOCAL_CHAT_MODEL`** 提供（默认 `llama3.2`）。
 */
export class HttpLocalChatProvider implements InferenceProvider {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async chat(
    messages: InferenceChatMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<{ content: string }> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const model = process.env.LOCAL_CHAT_MODEL?.trim() || "llama3.2";
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, readTimeoutMs());
    const signal = options?.signal;
    if (signal !== undefined) {
      if (signal.aborted) {
        clearTimeout(timeout);
        throw new OfflineModelUnavailableError("离线对话已取消。");
      }
      signal.addEventListener(
        "abort",
        () => {
          controller.abort();
        },
        { once: true },
      );
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      if (isLikelyNetworkFailure(e) || (e instanceof Error && e.name === "AbortError")) {
        throw new OfflineModelUnavailableError();
      }
      throw e;
    }
    clearTimeout(timeout);

    const text = await res.text();
    if (!res.ok) {
      throw new OfflineModelUnavailableError(
        `离线模型 HTTP ${String(res.status)}：${text.slice(0, 200)}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new OfflineModelUnavailableError("离线模型返回非 JSON。");
    }
    const choices = (parsed as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length < 1) {
      throw new OfflineModelUnavailableError("离线模型响应缺少 choices。");
    }
    const msg = (choices[0] as { message?: { content?: unknown } }).message;
    const content =
      msg !== undefined && typeof msg.content === "string" ? msg.content.trim() : "";
    if (content === "") {
      throw new OfflineModelUnavailableError("离线模型返回空正文。");
    }
    return { content };
  }

  async chatStream(
    messages: InferenceChatMessage[],
    options: {
      signal?: AbortSignal;
      onTokenDelta: (delta: string) => void;
    },
  ): Promise<{ content: string }> {
    const { content } = await this.chat(messages, options);
    options.onTokenDelta(content);
    return { content };
  }
}
