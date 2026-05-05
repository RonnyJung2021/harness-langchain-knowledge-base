import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/** 与指南一致：Web localStorage / RN AsyncStorage 共用此前缀。 */
export const KB_RAG_OFFLINE_PREF_PREFIX = "kb-rag-offline:v1";

export const PREFER_OFFLINE_STORAGE_KEY = `${KB_RAG_OFFLINE_PREF_PREFIX}:preferOffline`;

type NativeKv = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const nativeAsyncStorage = AsyncStorage as unknown as NativeKv;

export async function readStoredPreferOffline(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(PREFER_OFFLINE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }
  const v = await nativeAsyncStorage.getItem(PREFER_OFFLINE_STORAGE_KEY);
  return v === "1";
}

export async function writeStoredPreferOffline(value: boolean): Promise<void> {
  const payload = value ? "1" : "0";
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(PREFER_OFFLINE_STORAGE_KEY, payload);
    } catch {
      /* 隐私模式等 */
    }
    return;
  }
  await nativeAsyncStorage.setItem(PREFER_OFFLINE_STORAGE_KEY, payload);
}
