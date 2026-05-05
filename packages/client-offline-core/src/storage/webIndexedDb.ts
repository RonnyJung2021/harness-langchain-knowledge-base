import type { LocalKbBundle, SerializedMemoryVector } from "@kb-rag/shared";
import type { KbBundleStore } from "./types.js";

/** 与磁盘键名、文档约定对齐，便于多版本并存迁移。 */
export const KB_BUNDLE_STORE_SCHEMA_VERSION = "v1";

const DB_NAME = `kb-rag-bundle-${KB_BUNDLE_STORE_SCHEMA_VERSION}`;
const DB_VERSION = 1;
const STORE = "kv";

/** 单条 IndexedDB 记录体积上限目标（字符），避免部分浏览器单值过大；vectors 按块写入。 */
const MAX_VECTOR_CHUNK_CHARS = 900_000;

type KvRow = {
  key: string;
  value: string;
};

const KEY_MANIFEST = `kb-rag-bundle:${KB_BUNDLE_STORE_SCHEMA_VERSION}:manifest`;
const KEY_VECTOR_META = `kb-rag-bundle:${KB_BUNDLE_STORE_SCHEMA_VERSION}:vectors:meta`;
const KEY_VECTOR_CHUNK = (i: number) => `kb-rag-bundle:${KB_BUNDLE_STORE_SCHEMA_VERSION}:vectors:chunk:${String(i)}`;

function assertIndexedDb(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB 不可用：请在浏览器环境使用 createWebIndexedDbKbBundleStore，或换用 RN 实现");
  }
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = (): void => {
      reject(req.error ?? new Error("IndexedDB request failed"));
    };
    req.onsuccess = (): void => {
      resolve(req.result as T);
    };
  });
}

function idbTransactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = (): void => {
      resolve();
    };
    tx.onerror = (): void => {
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };
    tx.onabort = (): void => {
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
}

function openDb(): Promise<IDBDatabase> {
  assertIndexedDb();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = (): void => {
      reject(req.error ?? new Error("IndexedDB open failed"));
    };
    req.onupgradeneeded = (ev: IDBVersionChangeEvent): void => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = (): void => {
      resolve(req.result);
    };
  });
}

/** 将 vectors 切成多块，使每块 JSON 字符串不超过约 {@link MAX_VECTOR_CHUNK_CHARS}。 */
export function chunkSerializedVectors(vectors: SerializedMemoryVector[]): SerializedMemoryVector[][] {
  if (vectors.length === 0) {
    return [[]];
  }
  const chunks: SerializedMemoryVector[][] = [];
  let current: SerializedMemoryVector[] = [];
  for (const row of vectors) {
    const trial = [...current, row];
    const len = JSON.stringify(trial).length;
    if (current.length > 0 && len > MAX_VECTOR_CHUNK_CHARS) {
      chunks.push(current);
      current = [row];
      continue;
    }
    current = trial;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.length > 0 ? chunks : [[]];
}

class WebIndexedDbKbBundleStore implements KbBundleStore {
  async load(): Promise<LocalKbBundle | null> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const st = tx.objectStore(STORE);
      const manifestRow = await idbRequest(st.get(KEY_MANIFEST) as IDBRequest<KvRow | undefined>);
      if (manifestRow === undefined || manifestRow === null) {
        await idbTransactionComplete(tx);
        return null;
      }
      const metaRow = await idbRequest(st.get(KEY_VECTOR_META) as IDBRequest<KvRow | undefined>);
      if (metaRow === undefined || metaRow === null) {
        await idbTransactionComplete(tx);
        return null;
      }
      const chunkCount = Number.parseInt(metaRow.value, 10);
      if (!Number.isFinite(chunkCount) || chunkCount < 1) {
        await idbTransactionComplete(tx);
        return null;
      }

      const chunkRows: KvRow[] = [];
      for (let i = 0; i < chunkCount; i++) {
        const row = await idbRequest(st.get(KEY_VECTOR_CHUNK(i)) as IDBRequest<KvRow | undefined>);
        if (row === undefined || row === null) {
          await idbTransactionComplete(tx);
          return null;
        }
        chunkRows.push(row);
      }
      await idbTransactionComplete(tx);

      const manifest = JSON.parse(manifestRow.value) as LocalKbBundle["manifest"];
      const parts: SerializedMemoryVector[][] = [];
      for (const row of chunkRows) {
        const parsed = JSON.parse(row.value) as unknown;
        if (!Array.isArray(parsed)) {
          return null;
        }
        parts.push(parsed as SerializedMemoryVector[]);
      }
      const vectors = parts.flat();
      return { manifest, vectors };
    } finally {
      db.close();
    }
  }

  async save(bundle: LocalKbBundle): Promise<void> {
    const db = await openDb();
    try {
      const chunks = chunkSerializedVectors(bundle.vectors);
      const tx = db.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      st.clear();
      st.put({ key: KEY_MANIFEST, value: JSON.stringify(bundle.manifest) } satisfies KvRow);
      st.put({
        key: KEY_VECTOR_META,
        value: String(chunks.length),
      } satisfies KvRow);
      for (let i = 0; i < chunks.length; i++) {
        const part = chunks[i];
        if (part === undefined) {
          continue;
        }
        st.put({ key: KEY_VECTOR_CHUNK(i), value: JSON.stringify(part) } satisfies KvRow);
      }
      await idbTransactionComplete(tx);
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      await idbTransactionComplete(tx);
    } finally {
      db.close();
    }
  }
}

/** 浏览器端 `KbBundleStore`（IndexedDB + vectors 分片）。 */
export function createWebIndexedDbKbBundleStore(): KbBundleStore {
  return new WebIndexedDbKbBundleStore();
}
