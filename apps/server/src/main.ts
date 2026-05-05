import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import {
  createInMemorySessionStore,
  createRagDeps,
  getRepoRoot,
  loadKbRagContext,
} from "@kb-rag/api-core";
import { parseRuntimeMode } from "@kb-rag/shared";
import { createApp } from "./app.js";
import { createRootLogger } from "./logger.js";
import { createPerSessionExclusive } from "./sessionExclusive.js";
import { createReplaceKbExclusive } from "./replaceKbExclusive.js";

const DEFAULT_PORT = 8787;

function readPort(): number {
  const raw = process.env.PORT?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    throw new Error(`无效 PORT：${raw}`);
  }
  return n;
}

async function bootstrap(): Promise<void> {
  const logger = createRootLogger();
  const runtimeMode = parseRuntimeMode(process.env.RUNTIME_MODE);
  const loaded = await loadKbRagContext(runtimeMode);
  const ragTurnDeps = createRagDeps({ mode: runtimeMode, loaded });

  const sessionStore = createInMemorySessionStore();
  const enqueueSession = createPerSessionExclusive();
  const enqueueKbReplace = createReplaceKbExclusive();
  const repoRoot = getRepoRoot();
  const webDist = path.join(repoRoot, "apps", "web", "dist");
  const webOpts = fs.existsSync(path.join(webDist, "index.html")) ? { webDist } : undefined;
  const app = createApp(
    {
      sessionStore,
      ragTurnDeps,
      enqueueSession,
      repoRoot,
      arkConfig: loaded.cfg,
      enqueueKbReplace,
      runtimeMode,
    },
    { ...webOpts, logger },
  );

  const port = readPort();
  const server = http.createServer(app);

  server.on("error", (err: NodeJS.ErrnoException) => {
    logger.error({ err }, "HTTP server error");
    if (err.code === "EADDRINUSE") {
      logger.error(`端口 ${String(port)} 已被占用，请修改环境变量 PORT 或结束占用进程。`);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    logger.info(
      { port },
      `HTTP 监听端口 ${String(port)}（GET /healthz、GET /readyz、/v1/sessions …）`,
    );
  });

  function shutdown(signal: string): void {
    logger.info({ signal }, "收到关闭信号");
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
}

bootstrap().catch((err: unknown) => {
  const logger = createRootLogger();
  logger.fatal({ err }, err instanceof Error ? err.message : String(err));
  process.exit(1);
});
