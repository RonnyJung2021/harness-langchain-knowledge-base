import type { ApiErrorBody } from "./types";
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

export function errorToBannerText(e: unknown): string {
  if (e instanceof ApiRequestError) {
    return sanitizeForUi(e.message);
  }
  if (e instanceof Error) {
    return sanitizeForUi(e.message);
  }
  return sanitizeForUi(String(e));
}
