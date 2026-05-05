import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { effectiveOfflineForTesting } from "./effectiveOffline.js";

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

/** NetInfo：`isInternetReachable === false` 视为断网；`null` 视为未知，不按断网处理。 */
function netStateToConnected(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  if (state.isConnected === false) {
    return false;
  }
  if (state.isInternetReachable === false) {
    return false;
  }
  return true;
}

/**
 * - Web：`preferOffline || !navigator.onLine`
 * - RN：`preferOffline || !connected`（`@react-native-community/netinfo`）
 */
export function useEffectiveOffline(preferOffline: boolean): boolean {
  const [navOnline, setNavOnline] = useState(readNavigatorOnLine);
  const [netConnected, setNetConnected] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      const sync = (): void => {
        setNavOnline(readNavigatorOnLine());
      };
      sync();
      return subscribeWindowOnline(sync);
    }

    let cancelled = false;
    void NetInfo.fetch().then((s) => {
      if (!cancelled) {
        setNetConnected(netStateToConnected(s));
      }
    });
    const unsub = NetInfo.addEventListener((s) => {
      setNetConnected(netStateToConnected(s));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return Platform.OS === "web"
    ? effectiveOfflineForTesting({ preferOffline, platform: "web", navigatorOnLine: navOnline })
    : effectiveOfflineForTesting({ preferOffline, platform: "native", netConnected });
}
