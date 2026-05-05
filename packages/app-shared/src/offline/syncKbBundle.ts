import type { KbBundleStore } from "@kb-rag/client-offline-core";
import type { KbManifestV1, LocalKbBundle, SerializedMemoryVector } from "@kb-rag/shared";
import { joinApiPath } from "@kb-rag/shared";

/** 供 UI i18n / 分支的可枚举错误码（401 / 413 / 网络为要素 6 对齐）。 */
export const KB_BUNDLE_SYNC_ERROR_CODES = {
  MISSING_ADMIN_TOKEN: "KB_BUNDLE_SYNC_MISSING_ADMIN_TOKEN",
  NETWORK: "KB_BUNDLE_SYNC_NETWORK",
  UNAUTHORIZED: "KB_BUNDLE_SYNC_UNAUTHORIZED",
  PAYLOAD_TOO_LARGE: "KB_BUNDLE_SYNC_PAYLOAD_TOO_LARGE",
  HTTP_ERROR: "KB_BUNDLE_SYNC_HTTP_ERROR",
  INVALID_JSON: "KB_BUNDLE_SYNC_INVALID_JSON",
  INVALID_SCHEMA: "KB_BUNDLE_SYNC_INVALID_SCHEMA",
} as const;

export type KbBundleSyncErrorCode = (typeof KB_BUNDLE_SYNC_ERROR_CODES)[keyof typeof KB_BUNDLE_SYNC_ERROR_CODES];

export class KbBundleSyncError extends Error {
  readonly code: KbBundleSyncErrorCode;
  readonly httpStatus?: number;

  constructor(code: KbBundleSyncErrorCode, message: string, init?: { httpStatus?: number; cause?: unknown }) {
    super(message, init?.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "KbBundleSyncError";
    this.code = code;
    this.httpStatus = init?.httpStatus;
  }
}

export function kbBundleSyncErrorToUserMessage(err: unknown): string {
  if (err instanceof KbBundleSyncError) {
    switch (err.code) {
      case KB_BUNDLE_SYNC_ERROR_CODES.MISSING_ADMIN_TOKEN:
        return "未配置 Admin Token，无法拉取受保护接口。";
      case KB_BUNDLE_SYNC_ERROR_CODES.NETWORK:
        return "网络不可用或请求失败，请检查连接后重试。";
      case KB_BUNDLE_SYNC_ERROR_CODES.UNAUTHORIZED:
        return "鉴权失败（401）：请核对 Admin Token 与服务端 HTTP_ADMIN_TOKEN 是否一致。";
      case KB_BUNDLE_SYNC_ERROR_CODES.PAYLOAD_TOO_LARGE:
        return "响应体过大（413）：可联系管理员调整上限或启用 gzip。";
      case KB_BUNDLE_SYNC_ERROR_CODES.INVALID_JSON:
        return "服务端返回非 JSON，无法解析知识库包。";
      case KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA:
        return err.message.length > 0 ? err.message : "知识库包 JSON 字段不符合预期。";
      case KB_BUNDLE_SYNC_ERROR_CODES.HTTP_ERROR:
        return `同步失败（HTTP ${String(err.httpStatus ?? 0)}）：${err.message}`;
      default:
        return err.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function isLikelyNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) {
    return true;
  }
  if (e instanceof DOMException && e.name === "AbortError") {
    return false;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /network|fetch failed|failed to fetch|load failed|internet connection|offline|unreachable|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|NSURLErrorDomain/i.test(
    msg,
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNumberArray(a: unknown): a is number[] {
  return Array.isArray(a) && a.every((x) => typeof x === "number" && Number.isFinite(x));
}

function isSerializedVector(v: unknown): v is SerializedMemoryVector {
  if (!isRecord(v)) {
    return false;
  }
  if (typeof v.content !== "string") {
    return false;
  }
  if (!isNumberArray(v.embedding)) {
    return false;
  }
  if (!isRecord(v.metadata)) {
    return false;
  }
  if (v.id !== undefined && typeof v.id !== "string") {
    return false;
  }
  return true;
}

function parseKbManifestV1(raw: unknown): KbManifestV1 {
  if (!isRecord(raw)) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest 须为对象");
  }
  if (raw.version !== 1) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest.version 须为 1");
  }
  if (typeof raw.updatedAt !== "string" || raw.updatedAt.length === 0) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest.updatedAt 须为非空字符串");
  }
  if (typeof raw.embeddingModel !== "string" || raw.embeddingModel.length === 0) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest.embeddingModel 须为非空字符串");
  }
  if (typeof raw.totalChunks !== "number" || !Number.isFinite(raw.totalChunks) || raw.totalChunks < 0) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest.totalChunks 须为非负有限数");
  }
  if (!Array.isArray(raw.sources) || !raw.sources.every((s) => typeof s === "string")) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest.sources 须为字符串数组");
  }
  const lastIngest = raw.lastIngest;
  if (lastIngest !== undefined) {
    if (!isRecord(lastIngest)) {
      throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest.lastIngest 须为对象或省略");
    }
    if (typeof lastIngest.source !== "string" || typeof lastIngest.chunkCount !== "number" || typeof lastIngest.durationMs !== "number") {
      throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "manifest.lastIngest 须含 source、chunkCount、durationMs");
    }
  }
  return raw as KbManifestV1;
}

/** 校验 `GET /v1/knowledge-base/bundle` 响应体最小字段，返回 {@link LocalKbBundle}。 */
export function parseKbBundleResponseBody(json: unknown): LocalKbBundle {
  if (!isRecord(json)) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "响应体须为 JSON 对象");
  }
  const manifest = parseKbManifestV1(json.manifest);
  const vectorsRaw = json.vectors;
  if (!Array.isArray(vectorsRaw)) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA, "vectors 须为数组");
  }
  const vectors: SerializedMemoryVector[] = [];
  for (let i = 0; i < vectorsRaw.length; i += 1) {
    if (!isSerializedVector(vectorsRaw[i])) {
      throw new KbBundleSyncError(
        KB_BUNDLE_SYNC_ERROR_CODES.INVALID_SCHEMA,
        `vectors[${String(i)}] 缺少 content / embedding(number[]) / metadata(object)`,
      );
    }
    vectors.push(vectorsRaw[i]);
  }
  return { manifest, vectors };
}

/**
 * 在线拉取知识库快照并写入 `store`（与 Web IndexedDB / RN 文件+指针语义一致）。
 */
export async function syncKbBundleFromServer(
  apiBaseUrl: string,
  adminToken: string,
  store: KbBundleStore,
): Promise<void> {
  const token = adminToken.trim();
  if (token === "") {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.MISSING_ADMIN_TOKEN, "adminToken 为空");
  }
  const url = joinApiPath(apiBaseUrl, "/v1/knowledge-base/bundle");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.NETWORK, "无法连接服务端", { cause: e });
    }
    throw e;
  }

  const text = await res.text();
  if (res.status === 401) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.UNAUTHORIZED, "未授权", { httpStatus: 401 });
  }
  if (res.status === 413) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.PAYLOAD_TOO_LARGE, "负载过大", { httpStatus: 413 });
  }
  if (!res.ok) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.HTTP_ERROR, text.slice(0, 500), {
      httpStatus: res.status,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (e) {
    throw new KbBundleSyncError(KB_BUNDLE_SYNC_ERROR_CODES.INVALID_JSON, "响应非合法 JSON", { cause: e });
  }

  const bundle = parseKbBundleResponseBody(parsed);
  await store.save(bundle);
}
