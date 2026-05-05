import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  assertValidUuidSessionId,
  explainApiError,
  runRagChatTurn,
  runRagChatTurnStream,
} from "@kb-rag/api-core";
import type { ChatMessage } from "@kb-rag/shared";
import type { ChatServerContext } from "./chatServerContext.js";
import { isLikelyArkOrNetworkTimeout } from "./arkTimeout.js";
import { HttpError } from "./httpError.js";
import { readHttpChatMaxMessageChars } from "./messageLimits.js";
import { createMessagesPostRateLimiter } from "./rateLimits.js";
import { initSseResponse, writeSseEvent } from "./sseWrite.js";

function paramSessionId(v: string | string[] | undefined): string {
  if (v === undefined) {
    return "";
  }
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

function parseMessageTextBody(req: Request, maxChars: number): string {
  const body = req.body as unknown;
  if (body === null || typeof body !== "object" || !("text" in body)) {
    throw new HttpError(400, "INVALID_BODY", "请求体须为 JSON 对象，且包含 text 字段");
  }
  const textRaw = (body as { text?: unknown }).text;
  if (typeof textRaw !== "string") {
    throw new HttpError(400, "INVALID_BODY", "text 须为字符串");
  }
  const userText = textRaw.trim();
  if (userText === "") {
    throw new HttpError(400, "EMPTY_TEXT", "text 不能为空或仅空白");
  }
  if (userText.length > maxChars) {
    throw new HttpError(
      400,
      "MESSAGE_TOO_LONG",
      `text 长度不可超过 ${String(maxChars)} 字符`,
    );
  }
  return userText;
}

function mapRagFailureToHttpError(e: unknown): HttpError {
  if (isLikelyArkOrNetworkTimeout(e)) {
    return new HttpError(
      504,
      "ARK_TIMEOUT",
      "方舟或网络请求超时，请稍后重试；若持续出现可调高 ARK_REQUEST_TIMEOUT_MS 或检查网络。",
    );
  }
  const hint = explainApiError(e);
  const base = e instanceof Error ? e.message : String(e);
  const message = [hint, base].filter((s) => s.length > 0).join(" ");
  return new HttpError(502, "UPSTREAM", message || "模型或检索调用失败");
}

export function createV1SessionsRouter(ctx: ChatServerContext): Router {
  const router = Router();
  const maxChars = readHttpChatMaxMessageChars();
  const messagesPostLimiter = createMessagesPostRateLimiter();

  router.post(
    "/sessions",
    wrapAsync(async (_req, res) => {
      const sessionId = ctx.sessionStore.createSession();
      res.status(201).json({ sessionId });
    }),
  );

  router.get(
    "/sessions/:sessionId",
    wrapAsync(async (req, res) => {
      const sessionId = paramSessionId(req.params.sessionId);
      try {
        assertValidUuidSessionId(sessionId);
      } catch {
        throw new HttpError(400, "INVALID_SESSION_ID", "sessionId 须为合法 UUID");
      }
      const messages = ctx.sessionStore.get(sessionId);
      if (messages === undefined) {
        throw new HttpError(404, "SESSION_NOT_FOUND", "会话不存在");
      }
      res.status(200).json({ id: sessionId, messages });
    }),
  );

  router.post(
    "/sessions/:sessionId/messages",
    messagesPostLimiter,
    wrapAsync(async (req, res) => {
      const sessionId = paramSessionId(req.params.sessionId);
      try {
        assertValidUuidSessionId(sessionId);
      } catch {
        throw new HttpError(400, "INVALID_SESSION_ID", "sessionId 须为合法 UUID");
      }

      const userText = parseMessageTextBody(req, maxChars);

      const payload = await ctx.enqueueSession(sessionId, async () => {
        const history = ctx.sessionStore.get(sessionId);
        if (history === undefined) {
          throw new HttpError(404, "SESSION_NOT_FOUND", "会话不存在");
        }

        const now = () => new Date().toISOString();
        const userMsg: ChatMessage = {
          id: randomUUID(),
          role: "user",
          content: userText,
          createdAt: now(),
        };

        let assistantText: string;
        let citations: Awaited<ReturnType<typeof runRagChatTurn>>["citations"];
        let degraded: boolean | undefined;

        try {
          const turnOut = await runRagChatTurn({ sessionId, userText, history }, ctx.ragTurnDeps);
          assistantText = turnOut.assistantText;
          citations = turnOut.citations;
          degraded = turnOut.degraded;
        } catch (e) {
          throw mapRagFailureToHttpError(e);
        }

        ctx.sessionStore.append(sessionId, userMsg);
        ctx.sessionStore.append(sessionId, {
          id: randomUUID(),
          role: "assistant",
          content: assistantText,
          createdAt: now(),
        });

        return { answer: assistantText, citations, degraded };
      });

      res.status(200).json(payload);
    }),
  );

  /** 路径字面量 `messages:stream`（Express 中 `:` 须转义）。 */
  router.post(
    "/sessions/:sessionId/messages\\:stream",
    messagesPostLimiter,
    wrapAsync(async (req, res) => {
      const sessionId = paramSessionId(req.params.sessionId);
      try {
        assertValidUuidSessionId(sessionId);
      } catch {
        throw new HttpError(400, "INVALID_SESSION_ID", "sessionId 须为合法 UUID");
      }

      const userText = parseMessageTextBody(req, maxChars);

      await ctx.enqueueSession(sessionId, async () => {
        const history = ctx.sessionStore.get(sessionId);
        if (history === undefined) {
          throw new HttpError(404, "SESSION_NOT_FOUND", "会话不存在");
        }

        initSseResponse(res);

        const now = () => new Date().toISOString();
        const userMsg: ChatMessage = {
          id: randomUUID(),
          role: "user",
          content: userText,
          createdAt: now(),
        };

        let assistantText: string;
        let citations: Awaited<ReturnType<typeof runRagChatTurnStream>>["citations"];
        let degraded: boolean | undefined;

        try {
          const turnOut = await runRagChatTurnStream(
            { sessionId, userText, history },
            ctx.ragTurnDeps,
            (delta) => {
              writeSseEvent(res, "delta", { text: delta });
            },
          );
          assistantText = turnOut.assistantText;
          citations = turnOut.citations;
          degraded = turnOut.degraded;
        } catch (e) {
          const mapped = mapRagFailureToHttpError(e);
          writeSseEvent(res, "error", {
            code: mapped.code,
            message: mapped.message,
          });
          res.end();
          return;
        }

        ctx.sessionStore.append(sessionId, userMsg);
        ctx.sessionStore.append(sessionId, {
          id: randomUUID(),
          role: "assistant",
          content: assistantText,
          createdAt: now(),
        });

        writeSseEvent(res, "done", { citations, degraded });
        res.end();
      });
    }),
  );

  return router;
}
