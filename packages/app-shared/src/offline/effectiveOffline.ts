/**
 * 供 `useEffectiveOffline` 与单测使用：将「主动离线」与「网络不可用」折叠为单一布尔。
 */
export type EffectiveOfflineEnv = {
  preferOffline: boolean;
  /** `"web"`：`navigator.onLine`；`"native"`：NetInfo `isConnected` 等 */
  platform: "web" | "native";
  /** Web：`navigator.onLine`；缺省视为在线 */
  navigatorOnLine?: boolean;
  /** Native：已归一化「是否仍视为在线」；缺省视为在线 */
  netConnected?: boolean;
};

export function effectiveOfflineForTesting(env: EffectiveOfflineEnv): boolean {
  if (env.preferOffline) {
    return true;
  }
  if (env.platform === "web") {
    return env.navigatorOnLine === false;
  }
  return env.netConnected === false;
}
