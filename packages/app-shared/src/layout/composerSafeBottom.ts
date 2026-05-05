import { Platform } from "react-native";
import type { ViewStyle } from "react-native";

/**
 * Web：遵循底部安全区 env(safe-area-inset-bottom)；Native：固定最小内边距。
 * RN-web 运行时将字符串 padding 下发给 DOM（勿在 Native 使用字符串）。
 */
export function composerSafeBottomStyle(): Pick<ViewStyle, "paddingBottom"> {
  if (Platform.OS === "web") {
    return {
      paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" as unknown as number,
    };
  }
  return { paddingBottom: 12 };
}
