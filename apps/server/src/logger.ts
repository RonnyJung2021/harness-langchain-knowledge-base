import pino from "pino";

/** 根日志器：结构化 JSON；勿在此处记录完整 PDF、完整 prompt 或密钥。 */
export function createRootLogger(): pino.Logger {
  const levelRaw = process.env.LOG_LEVEL?.trim();
  const level =
    levelRaw !== undefined && levelRaw !== ""
      ? levelRaw
      : process.env.NODE_ENV === "production"
        ? "info"
        : "debug";
  return pino({
    level,
    base: { service: "kb-rag-http" },
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie"],
      remove: true,
    },
  });
}
