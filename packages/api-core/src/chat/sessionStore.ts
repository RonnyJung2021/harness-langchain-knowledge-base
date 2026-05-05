import { randomUUID } from "node:crypto";
import path from "node:path";
import { getRepoRoot } from "../paths/repoRoot.js";
import {
  isSessionPersistEnabled,
  readPersistedSession,
  writePersistedSession,
  type PersistedSessionRecord,
} from "./sessionPersistence.js";
import type { ChatMessage } from "@kb-rag/shared";

export type SessionStoreOptions = {
  /** 覆盖默认 `{repoRoot}/sessions`（测试注入） */
  sessionsDir?: string;
};

export type InMemorySessionStore = {
  createSession(): string;
  /**
   * 从 `sessions/{sessionId}.json` 载入消息；`sessionId` 须为合法 UUID。
   * 不要求已开启 `ARK_SESSION_PERSIST`（仅读盘）；开启后后续 `append` 会继续写盘。
   */
  resumeSession(sessionId: string): void;
  get(id: string): ChatMessage[] | undefined;
  append(id: string, msg: ChatMessage): void;
};

type SessionMeta = {
  createdAt: string;
};

/**
 * 进程内内存会话：每个 session 维护一条 `ChatMessage[]`，仅通过 append 追加。
 * `get` 返回当前消息的浅拷贝数组，避免调用方误改内部引用。
 * 当 `ARK_SESSION_PERSIST=1` 时，每次 `append` 后写入 `sessions/{id}.json`。
 */
export function createInMemorySessionStore(options?: SessionStoreOptions): InMemorySessionStore {
  const sessionsDir = options?.sessionsDir ?? path.join(getRepoRoot(), "sessions");
  const persist = isSessionPersistEnabled();
  const sessions = new Map<string, ChatMessage[]>();
  const meta = new Map<string, SessionMeta>();

  function persistIfEnabled(id: string): void {
    if (!persist) {
      return;
    }
    const list = sessions.get(id);
    const m = meta.get(id);
    if (list === undefined || m === undefined) {
      return;
    }
    const record: PersistedSessionRecord = {
      id,
      createdAt: m.createdAt,
      updatedAt: new Date().toISOString(),
      messages: list.map((msg) => ({ ...msg })),
    };
    writePersistedSession(sessionsDir, record);
  }

  return {
    createSession(): string {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      sessions.set(id, []);
      meta.set(id, { createdAt });
      if (persist) {
        writePersistedSession(sessionsDir, {
          id,
          createdAt,
          updatedAt: createdAt,
          messages: [],
        });
      }
      return id;
    },

    resumeSession(sessionId: string): void {
      const record = readPersistedSession(sessionsDir, sessionId);
      sessions.set(sessionId, [...record.messages]);
      meta.set(sessionId, { createdAt: record.createdAt });
      if (persist) {
        persistIfEnabled(sessionId);
      }
    },

    get(id: string): ChatMessage[] | undefined {
      const list = sessions.get(id);
      if (list === undefined) {
        return undefined;
      }
      return [...list];
    },

    append(id: string, msg: ChatMessage): void {
      const list = sessions.get(id);
      if (list === undefined) {
        throw new Error(`未知会话 id：${id}`);
      }
      list.push(msg);
      persistIfEnabled(id);
    },
  };
}
