import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { createArkChat } from "../ask/arkChat.js";
import { buildDefaultRagSystemPrompt } from "../chat/ragFormatting.js";
import { loadKbRagContext } from "../chat/loadKbRagContext.js";
import type { RagTurnDeps } from "../chat/ragTurn.js";
import { createInMemorySessionStore } from "../chat/sessionStore.js";
import { getRepoRoot } from "../paths/repoRoot.js";
import { createApp } from "./app.js";
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
  const { cfg, ragCfg, embeddings, vectorStore } = await loadKbRagContext();

  const ragTurnDeps: RagTurnDeps = {
    embeddings,
    vectorStore,
    ragConfig: ragCfg,
    createChat: () => createArkChat(cfg),
    buildSystemPrompt: buildDefaultRagSystemPrompt,
  };

  const sessionStore = createInMemorySessionStore();
  const enqueueSession = createPerSessionExclusive();
  const enqueueKbReplace = createReplaceKbExclusive();
  const repoRoot = getRepoRoot();
  const webDist = path.join(repoRoot, "web", "dist");
  const webOpts = fs.existsSync(path.join(webDist, "index.html")) ? { webDist } : undefined;
  const app = createApp(
    {
      sessionStore,
      ragTurnDeps,
      enqueueSession,
      repoRoot,
      arkConfig: cfg,
      enqueueKbReplace,
    },
    webOpts,
  );

  const port = readPort();
  const server = http.createServer(app);

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("HTTP server error:", err);
    if (err.code === "EADDRINUSE") {
      console.error(`端口 ${String(port)} 已被占用，请修改环境变量 PORT 或结束占用进程。`);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.error(`HTTP 监听端口 ${String(port)}（GET /healthz、/v1/sessions …）`);
  });

  function shutdown(signal: string): void {
    console.error(`收到 ${signal}，正在关闭…`);
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
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
