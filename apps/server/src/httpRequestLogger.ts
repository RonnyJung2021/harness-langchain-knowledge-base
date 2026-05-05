import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestHandler } from "express";
import type pino from "pino";
import { pinoHttp } from "pino-http";

/** HTTP 访问日志：分配 `req.id` / `X-Request-Id`，供错误体与 pino 字段关联。 */
export function createHttpRequestLoggerMiddleware(root: pino.Logger): RequestHandler {
  return pinoHttp({
    logger: root,
    genReqId: (req: IncomingMessage): string => {
      const h = req.headers["x-request-id"];
      if (typeof h === "string") {
        const t = h.trim();
        if (t.length > 0) {
          return t.slice(0, 128);
        }
      }
      return randomUUID();
    },
    customProps: (req: IncomingMessage & { id?: string }) => ({
      requestId: typeof req.id === "string" ? req.id : undefined,
    }),
    autoLogging: {
      ignore: (req: IncomingMessage) => {
        const u = req.url ?? "";
        return u === "/healthz" || u === "/readyz" || u.startsWith("/healthz?") || u.startsWith("/readyz?");
      },
    },
    serializers: {
      req: (req: IncomingMessage & { id?: string; method?: string; url?: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
      }),
    },
  }) as RequestHandler;
}
