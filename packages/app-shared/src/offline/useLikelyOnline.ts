import { useEffect, useState } from "react";

function readNavigatorOnLine(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

function subscribeWindowOnline(cb: () => void): () => void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * 用于「仅在线时显示同步」等 UI；未暴露 NetInfo 前依赖 `navigator.onLine` + window online/offline。
 */
export function useLikelyOnline(): boolean {
  const [online, setOnline] = useState(readNavigatorOnLine);
  useEffect(() => {
    const sync = (): void => {
      setOnline(readNavigatorOnLine());
    };
    sync();
    return subscribeWindowOnline(sync);
  }, []);
  return online;
}
