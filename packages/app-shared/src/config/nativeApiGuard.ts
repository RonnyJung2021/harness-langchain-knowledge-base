import { normalizeApiBaseUrl } from "@kb-rag/shared";
import { Platform } from "react-native";

/** Native 侧若未配置 API 根，返回提示文案；Web（含 RN Web）返回 `null`。 */
export function warnIfNativeMissingApiBase(apiBaseUrl: string): string | null {
  if (Platform.OS === "web") {
    return null;
  }
  if (normalizeApiBaseUrl(apiBaseUrl) === "") {
    return "Native 未配置 EXPO_PUBLIC_API_BASE_URL：请在 apps/mobile/.env 填写 API 根 URL（安卓模拟器访问本机常用 http://10.0.2.2:8788）。切勿将方舟密钥写入 EXPO_PUBLIC_*。";
  }
  return null;
}
