import type { LocalKbBundle } from "@kb-rag/shared";

/**
 * 端内 `LocalKbBundle`（manifest + vectors）持久化抽象；Web 用 IndexedDB，RN 可另实现 AsyncStorage/FileSystem。
 */
export interface KbBundleStore {
  load(): Promise<LocalKbBundle | null>;
  save(bundle: LocalKbBundle): Promise<void>;
  clear(): Promise<void>;
}
