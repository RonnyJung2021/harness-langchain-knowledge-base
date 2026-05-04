import type { ApiErrorBody, CitationSummary } from "./types";
import { describeHttpFailure, sanitizeForUi } from "./httpFeedback";

export type ApiRequestErrorInit = {
  status: number;
  code?: string;
  message?: string;
  body?: unknown;
  /** `fetch` 抛错（网络断开、CORS、DNS 等） */
  network?: boolean;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;
  readonly network: boolean;

  constructor(init: ApiRequestErrorInit) {
    const user =
      init.network === true
        ? "网络异常：无法连接服务器（请确认已启动 pnpm serve、代理与防火墙）。"
        : describeHttpFailure(init.status, init.code, init.message);
    super(user);
    this.name = "ApiRequestError";
    this.status = init.status;
    this.code = init.code;
    this.body = init.body;
    this.network = init.network === true;
  }
}

function parseErrorBody(parsed: unknown): { code?: string; message?: string } {
  if (parsed === null || typeof parsed !== "object" || !("error" in parsed)) {
    return {};
  }
  const e = (parsed as ApiErrorBody).error;
  const code = typeof e?.code === "string" ? e.code : undefined;
  const message = typeof e?.message === "string" ? e.message : undefined;
  return { code, message };
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error && /network|fetch|Failed to fetch|Load failed/i.test(e.message));
    if (isNetwork) {
      throw new ApiRequestError({ status: 0, network: true });
    }
    throw e;
  }

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text === "" ? null : JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const { code, message } = parseErrorBody(parsed);
    throw new ApiRequestError({
      status: res.status,
      code,
      message,
      body: parsed,
    });
  }

  return parsed as T;
}

export type PostSessionMessageStreamResult = {
  citations: CitationSummary[];
  degraded?: boolean;
};

function parseSseFrameBlock(block: string): { event: string; data: string } {
  let event = "message";
  const dataLines: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }
  return { event, data: dataLines.join("\n") };
}

/**
 * `POST /v1/sessions/:id/messages:stream`：用 `fetch` 读 `ReadableStream` 并解析 SSE。
 * （`EventSource` 仅支持 GET，无法携带 JSON body，故流式端须用本函数或等价实现。）
 */
export async function postSessionMessageStream(
  sessionId: string,
  text: string,
  onDelta: (delta: string) => void,
): Promise<PostSessionMessageStreamResult> {
  let doneResult: PostSessionMessageStreamResult | null = null;

  const dispatchSseBlock = (block: string): void => {
    const { event, data } = parseSseFrameBlock(block);
    if (event === "delta") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data) as unknown;
      } catch {
        return;
      }
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "text" in parsed &&
        typeof (parsed as { text?: unknown }).text === "string"
      ) {
        onDelta((parsed as { text: string }).text);
      }
      return;
    }
    if (event === "done") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data) as unknown;
      } catch {
        throw new ApiRequestError({ status: 502, message: "SSE done 帧 JSON 无效" });
      }
      if (parsed === null || typeof parsed !== "object" || !("citations" in parsed)) {
        throw new ApiRequestError({ status: 502, message: "SSE done 帧缺少 citations" });
      }
      const c = (parsed as { citations?: unknown }).citations;
      if (!Array.isArray(c)) {
        throw new ApiRequestError({ status: 502, message: "SSE citations 须为数组" });
      }
      const degraded =
        "degraded" in parsed && typeof (parsed as { degraded?: unknown }).degraded === "boolean"
          ? (parsed as { degraded: boolean }).degraded
          : undefined;
      doneResult = { citations: c as CitationSummary[], degraded };
      return;
    }
    if (event === "error") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data) as unknown;
      } catch {
        throw new ApiRequestError({ status: 502, message: "SSE error 帧无效" });
      }
      const errCode =
        parsed !== null &&
        typeof parsed === "object" &&
        "code" in parsed &&
        typeof (parsed as { code?: unknown }).code === "string"
          ? (parsed as { code: string }).code
          : "UPSTREAM";
      const errMessage =
        parsed !== null &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof (parsed as { message?: unknown }).message === "string"
          ? (parsed as { message: string }).message
          : "流式调用失败";
      throw new ApiRequestError({ status: 502, code: errCode, message: errMessage });
    }
  };

  let res: Response;
  try {
    res = await fetch(`/v1/sessions/${sessionId}/messages:stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    const isNetwork =
      e instanceof TypeError ||
      (e instanceof Error && /network|fetch|Failed to fetch|Load failed/i.test(e.message));
    if (isNetwork) {
      throw new ApiRequestError({ status: 0, network: true });
    }
    throw e;
  }

  if (!res.ok) {
    const t = await res.text();
    let parsed: unknown = t;
    try {
      parsed = t === "" ? null : JSON.parse(t);
    } catch {
      parsed = t;
    }
    const { code, message } =
      parsed === null || typeof parsed !== "object" || !("error" in parsed)
        ? {}
        : (() => {
            const e0 = (parsed as ApiErrorBody).error;
            return {
              code: typeof e0?.code === "string" ? e0.code : undefined,
              message: typeof e0?.message === "string" ? e0.message : undefined,
            };
          })();
    throw new ApiRequestError({ status: res.status, code, message, body: parsed });
  }

  const reader = res.body?.getReader();
  if (reader === undefined) {
    throw new ApiRequestError({
      status: res.status,
      message: "响应无 body，无法读取流",
    });
  }

  const decoder = new TextDecoder();
  let carry = "";

  const flushCarry = (): void => {
    for (;;) {
      const sep = carry.indexOf("\n\n");
      if (sep < 0) {
        break;
      }
      const block = carry.slice(0, sep);
      carry = carry.slice(sep + 2);
      dispatchSseBlock(block);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    carry += decoder.decode(value, { stream: true });
    flushCarry();
  }

  carry += decoder.decode();
  flushCarry();

  if (doneResult === null) {
    throw new ApiRequestError({
      status: 502,
      message: "流结束但未收到 done 帧",
    });
  }

  return doneResult;
}

export function errorToBannerText(e: unknown): string {
  if (e instanceof ApiRequestError) {
    return sanitizeForUi(e.message);
  }
  if (e instanceof Error) {
    return sanitizeForUi(e.message);
  }
  return sanitizeForUi(String(e));
}
