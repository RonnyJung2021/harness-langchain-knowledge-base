/**
 * 端内离线相关错误码与用户可见中文横幅（不含技术栈细节；可与日志中的 code 关联）。
 * @see packages/app-shared 中双模式聊天、同步失败提示
 */

export const OFFLINE_USER_ERROR_CODES = {
  OFFLINE_NO_BUNDLE: "OFFLINE_NO_BUNDLE",
  OFFLINE_CORRUPT_BUNDLE: "OFFLINE_CORRUPT_BUNDLE",
  OFFLINE_SYNC_FAILED: "OFFLINE_SYNC_FAILED",
  OFFLINE_NO_STORE: "OFFLINE_NO_STORE",
  OFFLINE_RAG_FAILED: "OFFLINE_RAG_FAILED",
} as const;

export type OfflineUserErrorCode = (typeof OFFLINE_USER_ERROR_CODES)[keyof typeof OFFLINE_USER_ERROR_CODES];

const BANNER_ZH: Record<OfflineUserErrorCode, string> = {
  [OFFLINE_USER_ERROR_CODES.OFFLINE_NO_BUNDLE]:
    "本机还没有可用的知识库内容。请在「连接自检」里先同步知识库到本机，再使用离线对话。",
  [OFFLINE_USER_ERROR_CODES.OFFLINE_CORRUPT_BUNDLE]:
    "本机知识库数据可能损坏或与当前版本不兼容。请尝试重新从服务端同步知识库；若仍失败请联系管理员。",
  [OFFLINE_USER_ERROR_CODES.OFFLINE_SYNC_FAILED]:
    "知识库同步失败。请检查网络、管理员口令是否正确，或稍后再试。",
  [OFFLINE_USER_ERROR_CODES.OFFLINE_NO_STORE]:
    "当前页面未启用本机知识库存储，无法使用离线对话。请使用已集成本地存储的客户端。",
  [OFFLINE_USER_ERROR_CODES.OFFLINE_RAG_FAILED]:
    "离线回答生成失败。您可以重试；若反复出现，请重新同步知识库后再试。",
};

export function offlineUserBannerMessage(code: OfflineUserErrorCode): string {
  return BANNER_ZH[code];
}

const RAG_CORRUPT_HINT = /维度|向量|bundle|embedding|首条向量|不一致|为空/i;

/**
 * 将底层异常摘要映射为「损坏包」或通用「RAG 失败」横幅（截断避免横幅过长）。
 */
export function offlineRagFailureUserBanner(technical: string): string {
  const t = technical.trim();
  const short = t.length > 160 ? `${t.slice(0, 160)}…` : t;
  if (RAG_CORRUPT_HINT.test(t)) {
    return `${BANNER_ZH[OFFLINE_USER_ERROR_CODES.OFFLINE_CORRUPT_BUNDLE]}（${short}）`;
  }
  return `${BANNER_ZH[OFFLINE_USER_ERROR_CODES.OFFLINE_RAG_FAILED]}（${short}）`;
}
