import "dotenv/config";

const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

function requireNonEmptyEnv(name: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    throw new Error(
      `缺少环境变量 ${name}：请复制 .env.example 为 .env 并填写，或在当前 shell 中导出该变量后再运行。`,
    );
  }
  return raw.trim();
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export type ArkEnvConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embedModel: string;
};

/**
 * 从环境变量读取方舟 OpenAI 兼容接入配置（不写死密钥）。
 * ARK_BASE_URL 未设置时使用北京区域默认接入点。
 */
export function loadArkConfig(): ArkEnvConfig {
  const apiKey = requireNonEmptyEnv("ARK_API_KEY");
  const chatModel = requireNonEmptyEnv("ARK_CHAT_MODEL");
  const embedModel = requireNonEmptyEnv("ARK_EMBED_MODEL");

  const baseRaw = process.env.ARK_BASE_URL;
  const baseUrl = normalizeBaseUrl(
    baseRaw !== undefined && baseRaw.trim() !== ""
      ? baseRaw.trim()
      : DEFAULT_ARK_BASE_URL,
  );

  return {
    apiKey,
    baseUrl,
    chatModel,
    embedModel,
  };
}
