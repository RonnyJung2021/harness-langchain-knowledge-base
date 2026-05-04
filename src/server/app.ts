import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { buildCorsOptions } from "./corsConfig.js";
import type { ChatServerContext } from "./chatServerContext.js";
import { HttpError } from "./httpError.js";
import { createV1KbReplaceRouter } from "./v1KbReplaceRoutes.js";
import { createV1SessionsRouter } from "./v1SessionsRoutes.js";

export type CreateAppOptions = {
  /** 生产构建前端目录（存在 `index.html` 时启用静态资源 + SPA fallback；`/v1` 不会被 fallback 吞掉） */
  webDist?: string;
};

export function createApp(ctx: ChatServerContext, opts?: CreateAppOptions): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors(buildCorsOptions()));
  app.use(express.json());

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
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
        if (req.method !== "GET" || req.path.startsWith("/v1")) {
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
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Not found" },
    });
  });

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    console.error(err);
    res.status(500).json({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
  });

  return app;
}

export type { ChatServerContext } from "./chatServerContext.js";
