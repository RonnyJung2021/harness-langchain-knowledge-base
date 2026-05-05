import type { Request, RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

function readRateLimitEnabled(): boolean {
  const v = process.env.HTTP_RATE_LIMIT_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function readRateLimitBySession(): boolean {
  const v = process.env.HTTP_RATE_LIMIT_BY_SESSION?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * 对「会话消息」POST（非流式与 SSE）限流：默认关闭（`HTTP_RATE_LIMIT_ENABLED`），
 * 开启后按 IP；可选叠加 `sessionId`（`HTTP_RATE_LIMIT_BY_SESSION=1`）。
 */
export function createMessagesPostRateLimiter(): RequestHandler {
  const windowMsRaw = process.env.HTTP_RATE_LIMIT_WINDOW_MS?.trim();
  const maxRaw = process.env.HTTP_RATE_LIMIT_MAX?.trim();
  const windowMs = Number.parseInt(windowMsRaw ?? "900000", 10);
  const max = Number.parseInt(maxRaw ?? "120", 10);
  const bySession = readRateLimitBySession();

  return rateLimit({
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 900_000,
    limit: Number.isFinite(max) && max > 0 ? max : 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !readRateLimitEnabled(),
    keyGenerator: (req: Request): string => {
      const rawIp = req.ip ?? req.socket.remoteAddress ?? "unknown";
      const ip = ipKeyGenerator(rawIp);
      if (!bySession) {
        return ip;
      }
      const sid = req.params.sessionId;
      return typeof sid === "string" && sid.length > 0 ? `${ip}:${sid}` : ip;
    },
    handler: (req, res): void => {
      const requestId = typeof req.id === "string" ? req.id : "";
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "请求过于频繁，请稍后再试。",
          ...(requestId !== "" ? { requestId } : {}),
        },
      });
    },
  });
}
