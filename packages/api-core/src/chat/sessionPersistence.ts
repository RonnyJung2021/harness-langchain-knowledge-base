import fs from "node:fs";
import path from "node:path";
import type { ChatMessage } from "@kb-rag/shared";

/** 落盘文件名 `{sessionId}.json` 与文件内 `id` 一致。 */
export type PersistedSessionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

/**
 * 校验 `sessionId` 为 UUID 字符串（拒绝路径字符与穿越）。
 * 采用 RFC 4122 常见文本格式：8-4-4-4-12 十六进制段。
 */
export function assertValidUuidSessionId(sessionId: string): void {
  if (typeof sessionId !== "string" || sessionId.length !== 36) {
    throw new Error("sessionId 须为 36 字符的 UUID 文本");
  }
  if (sessionId !== sessionId.trim()) {
    throw new Error("sessionId 首尾不可含空白");
  }
  if (/[/\\.]/.test(sessionId)) {
    throw new Error("sessionId 含非法字符");
  }
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(sessionId)) {
    throw new Error("sessionId 不是合法的 UUID 格式");
  }
}

/** 解析为绝对路径并保证落在 `sessionsDir` 之下（防路径穿越）。 */
export function resolvedSessionJsonPath(sessionsDir: string, sessionId: string): string {
  assertValidUuidSessionId(sessionId);
  const base = path.resolve(sessionsDir);
  const file = path.resolve(base, `${sessionId}.json`);
  const rel = path.relative(base, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("非法会话路径");
  }
  return file;
}

function isChatMessage(x: unknown): x is ChatMessage {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.role === "user" || o.role === "assistant" || o.role === "system") &&
    typeof o.content === "string" &&
    typeof o.createdAt === "string"
  );
}

export function parsePersistedSessionJson(
  raw: string,
  expectedSessionId: string,
): PersistedSessionRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("会话文件不是合法 JSON");
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("会话文件根须为对象");
  }
  const o = parsed as Record<string, unknown>;
  if (o.id !== expectedSessionId) {
    throw new Error("会话文件内 id 与请求的 sessionId 不一致");
  }
  if (typeof o.createdAt !== "string" || typeof o.updatedAt !== "string") {
    throw new Error("会话文件缺少 createdAt / updatedAt");
  }
  if (!Array.isArray(o.messages)) {
    throw new Error("会话文件 messages 须为数组");
  }
  const messages = o.messages;
  if (!messages.every(isChatMessage)) {
    throw new Error("messages 中存在不符合 ChatMessage 形状的项");
  }
  return {
    id: o.id,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    messages: [...messages],
  };
}

export function readPersistedSession(
  sessionsDir: string,
  sessionId: string,
): PersistedSessionRecord {
  const filePath = resolvedSessionJsonPath(sessionsDir, sessionId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`未找到会话快照：${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return parsePersistedSessionJson(raw, sessionId);
}

export function writePersistedSession(
  sessionsDir: string,
  record: PersistedSessionRecord,
): void {
  assertValidUuidSessionId(record.id);
  const filePath = resolvedSessionJsonPath(sessionsDir, record.id);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const out: PersistedSessionRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
}

export function isSessionPersistEnabled(): boolean {
  return process.env.ARK_SESSION_PERSIST === "1";
}
