import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type pino from "pino";
import { buildCorsOptions } from "./corsConfig.js";
import type { ChatServerContext } from "./chatServerContext.js";
import { createHttpRequestLoggerMiddleware } from "./httpRequestLogger.js";
import { HttpError } from "./httpError.js";
import { readHttpJsonBodyMaxBytes } from "./jsonBodyLimit.js";
import { handleReadyz } from "./readyzHandler.js";
import { createV1KbReplaceRouter } from "./v1KbReplaceRoutes.js";
import { createV1SessionsRouter } from "./v1SessionsRoutes.js";

export type CreateAppOptions = {
  /** 生产构建前端目录（存在 `index.html` 时启用静态资源 + SPA fallback；`/v1` 不会被 fallback 吞掉） */
  webDist?: string;
  /** 结构化日志（pino）；访问日志与错误关联 `requestId` / `X-Request-Id`。 */
  logger: pino.Logger;
};

function isJsonBodyTooLarge(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const o = err as { type?: unknown; status?: unknown; statusCode?: unknown };
  if (o.type === "entity.too.large") {
    return true;
  }
  if (o.status === 413 || o.statusCode === 413) {
    return true;
  }
  return false;
}

function readTrustProxy(): boolean {
  const v = process.env.HTTP_TRUST_PROXY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function createApp(ctx: ChatServerContext, opts?: CreateAppOptions): express.Express {
  const logger = opts?.logger;
  if (logger === undefined) {
    throw new Error("createApp：须在 options 中传入 logger（见 main.ts createRootLogger）");
  }

  const app = express();

  app.disable("x-powered-by");
  if (readTrustProxy()) {
    app.set("trust proxy", 1);
  }

  app.use(createHttpRequestLoggerMiddleware(logger));
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: readHttpJsonBodyMaxBytes() }));

  /**
   * 与 v3 一致的生产挂载顺序（同源单进程）：
   * 1) 业务与探活 API（含 `/v1/*`）——必须先注册，避免被静态或 SPA fallback 吞掉
   * 2) `express.static(apps/web/dist)` —— `pnpm build:web` 产物
   * 3) SPA fallback：`GET` 且非 API 路径 → `index.html`
   */
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  });

  app.get("/readyz", (req: Request, res: Response, next: NextFunction) => {
    void handleReadyz(ctx.repoRoot, req, res).catch(next);
  });

  app.get("/v1/runtime", (_req: Request, res: Response) => {
    res.status(200).json({ mode: ctx.runtimeMode });
  });

  app.get("/v1/runtime-info", (_req: Request, res: Response) => {
    res.status(200).json(ctx.runtimeInfo);
  });

  app.use("/v1", createV1SessionsRouter(ctx));
  app.use("/v1", createV1KbReplaceRouter(ctx));

  const webDist = opts?.webDist;
  if (webDist !== undefined && webDist !== "") {
    const abs = path.resolve(webDist);
    const indexHtml = path.join(abs, "index.html");
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(abs));
      app.use((req: Request, res: Response, next: NextFunction) => {
        const p = req.path;
        if (
          req.method !== "GET" ||
          p.startsWith("/v1") ||
          p === "/healthz" ||
          p === "/readyz"
        ) {
          next();
          return;
        }
        res.sendFile(indexHtml, (err) => {
          if (err !== undefined && err !== null) {
            next(err);
          }
        });
      });
    }
  }

  app.use((_req: Request, res: Response) => {
    const requestId = typeof _req.id === "string" ? _req.id : undefined;
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Not found",
        ...(requestId !== undefined ? { requestId } : {}),
      },
    });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const requestId = typeof req.id === "string" ? req.id : undefined;
    const baseErr = (code: string, message: string, status: number): void => {
      res.status(status).json({
        error: {
          code,
          message,
          ...(requestId !== undefined ? { requestId } : {}),
        },
      });
    };

    if (isJsonBodyTooLarge(err)) {
      logger.warn({ err, requestId }, "json body too large");
      baseErr(
        "PAYLOAD_TOO_LARGE",
        "JSON 请求体超过 HTTP_JSON_BODY_MAX_BYTES 限制（与 KB 上传上限独立）。",
        413,
      );
      return;
    }
    if (err instanceof HttpError) {
      if (err.statusCode >= 500) {
        logger.error(
          { err, requestId, httpStatus: err.statusCode, bizCode: err.code },
          err.message,
        );
      } else {
        logger.warn(
          { requestId, httpStatus: err.statusCode, bizCode: err.code },
          err.message,
        );
      }
      baseErr(err.code, err.message, err.statusCode);
      return;
    }
    logger.error({ err, requestId }, "unhandled error");
    baseErr("INTERNAL", "Internal server error", 500);
  });

  return app;
}

export type { ChatServerContext } from "./chatServerContext.js";
