import {
  chunkSerializedVectors,
  KB_BUNDLE_STORE_SCHEMA_VERSION,
  type KbBundleStore,
} from "@kb-rag/client-offline-core";
import type { LocalKbBundle } from "@kb-rag/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

/**
 * AsyncStorage 仅存轻量 pointer（manifest + 向量文件相对名列表），大 JSON 落在 `documentDirectory` 文件，
 * 避免 AsyncStorage 单行体积限制（Android 等环境常见 ~2MB 量级）。
 */
const POINTER_KEY = `kb-rag-bundle:${KB_BUNDLE_STORE_SCHEMA_VERSION}:rn-pointer`;

/** 单文件 JSON 字符数低于此值则写单文件；否则按 {@link chunkSerializedVectors} 分片（与 Web IndexedDB 策略对齐）。 */
const SINGLE_VECTOR_FILE_MAX_CHARS = 900_000;

type RnBundlePointerV1 = {
  schemaVersion: typeof KB_BUNDLE_STORE_SCHEMA_VERSION;
  manifest: LocalKbBundle["manifest"];
  vectorFiles: string[];
};

function documentBaseDir(): string {
  const d = FileSystem.documentDirectory;
  if (d === null || d === undefined || d === "") {
    throw new Error("RN KbBundleStore：FileSystem.documentDirectory 不可用");
  }
  return d.endsWith("/") ? d : `${d}/`;
}

function fileUri(relativeName: string): string {
  return `${documentBaseDir()}${relativeName}`;
}

function vectorChunksForWrite(vectors: LocalKbBundle["vectors"]): LocalKbBundle["vectors"][] {
  const s = JSON.stringify(vectors);
  if (s.length <= SINGLE_VECTOR_FILE_MAX_CHARS) {
    return [vectors];
  }
  return chunkSerializedVectors(vectors);
}

async function deleteFilesFromPointerJson(raw: string | null): Promise<void> {
  if (raw === null || raw.trim() === "") {
    return;
  }
  try {
    const pointer = JSON.parse(raw) as RnBundlePointerV1;
    if (!Array.isArray(pointer.vectorFiles)) {
      return;
    }
    for (const name of pointer.vectorFiles) {
      const uri = fileUri(name);
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    }
  } catch {
    /* 损坏或旧格式 pointer：忽略文件删除 */
  }
}

class RnKbBundleStore implements KbBundleStore {
  async load(): Promise<LocalKbBundle | null> {
    const raw = await AsyncStorage.getItem(POINTER_KEY);
    if (raw === null || raw.trim() === "") {
      return null;
    }
    let pointer: RnBundlePointerV1;
    try {
      pointer = JSON.parse(raw) as RnBundlePointerV1;
    } catch {
      return null;
    }
    if (pointer.schemaVersion !== KB_BUNDLE_STORE_SCHEMA_VERSION || !Array.isArray(pointer.vectorFiles)) {
      return null;
    }
    const acc: LocalKbBundle["vectors"] = [];
    for (const name of pointer.vectorFiles) {
      const uri = fileUri(name);
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        return null;
      }
      const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        return null;
      }
      acc.push(...(parsed as LocalKbBundle["vectors"]));
    }
    return { manifest: pointer.manifest, vectors: acc };
  }

  async save(bundle: LocalKbBundle): Promise<void> {
    const prev = await AsyncStorage.getItem(POINTER_KEY);
    await deleteFilesFromPointerJson(prev);

    const chunks = vectorChunksForWrite(bundle.vectors);
    const names: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const name = `kb-rag-bundle-${KB_BUNDLE_STORE_SCHEMA_VERSION}-vec-${String(i)}.json`;
      names.push(name);
      const chunk = chunks[i];
      if (chunk === undefined) {
        continue;
      }
      await FileSystem.writeAsStringAsync(fileUri(name), JSON.stringify(chunk), {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    const pointer: RnBundlePointerV1 = {
      schemaVersion: KB_BUNDLE_STORE_SCHEMA_VERSION,
      manifest: bundle.manifest,
      vectorFiles: names,
    };
    await AsyncStorage.setItem(POINTER_KEY, JSON.stringify(pointer));
  }

  async clear(): Promise<void> {
    const raw = await AsyncStorage.getItem(POINTER_KEY);
    await deleteFilesFromPointerJson(raw);
    await AsyncStorage.removeItem(POINTER_KEY);
  }
}

/** Android / iOS 共用的 `KbBundleStore`；依赖 Expo，仅放在 `apps/mobile`。 */
export function createRnKbBundleStore(): KbBundleStore {
  return new RnKbBundleStore();
}
