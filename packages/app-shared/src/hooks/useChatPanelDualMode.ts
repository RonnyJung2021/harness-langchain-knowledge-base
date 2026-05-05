import type { KbBundleStore } from "@kb-rag/client-offline-core";
import { runLocalRagTurn } from "@kb-rag/client-offline-core";
import type { ChatMessage, CitationSummary, PostSessionMessageResponseBody } from "@kb-rag/shared";
import { OFFLINE_USER_ERROR_CODES, offlineRagFailureUserBanner, offlineUserBannerMessage } from "@kb-rag/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, errorToBannerText, fetchJson } from "../api/httpApi.js";

function mkMessageId(): string {
  const c = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (typeof c === "function") {
    return c();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatAssistantContent(answer: string, citations: CitationSummary[]): string {
  if (citations.length === 0) {
    return answer;
  }
  const lines = citations.map(
    (c) =>
      `[${String(c.index)}] ${c.sourceFile} #${String(c.chunkIndex)}（score=${c.score.toFixed(3)}）${c.preview80}`,
  );
  return `${answer}\n\n引用：\n${lines.join("\n")}`;
}

/**
 * 在线走 HTTP 会话；有效离线时走本机 {@link runLocalRagTurn}，消息仅驻内存。
 */
export function useChatPanelDualMode(opts: {
  apiBaseUrl: string;
  sessionId: string | null;
  effectiveOffline: boolean;
  bundleStore: KbBundleStore | null;
  onNotice: (msg: string, kind: "ok" | "err") => void;
}): {
  messages: ChatMessage[];
  busy: boolean;
  send: (text: string) => Promise<void>;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const prevEffectiveOffline = useRef(opts.effectiveOffline);
  useEffect(() => {
    if (opts.effectiveOffline && !prevEffectiveOffline.current) {
      setMessages([]);
    }
    prevEffectiveOffline.current = opts.effectiveOffline;
  }, [opts.effectiveOffline]);

  useEffect(() => {
    if (opts.effectiveOffline) {
      return;
    }
    if (opts.sessionId === null) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetchJson<{ id: string; messages: ChatMessage[] }>(
          opts.apiBaseUrl,
          `/v1/sessions/${opts.sessionId}`,
        );
        if (!cancelled) {
          setMessages(r.messages);
        }
      } catch (e) {
        if (!cancelled) {
          opts.onNotice(errorToBannerText(e), "err");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opts.sessionId, opts.apiBaseUrl, opts.onNotice, opts.effectiveOffline]);

  useEffect(() => {
    if (!opts.effectiveOffline) {
      return;
    }
    setMessages([]);
  }, [opts.sessionId, opts.effectiveOffline]);

  const send = useCallback(
    async (text: string) => {
      if (opts.sessionId === null || text.trim() === "") {
        return;
      }
      if (!opts.effectiveOffline) {
        setBusy(true);
        try {
          await fetchJson<PostSessionMessageResponseBody>(opts.apiBaseUrl, `/v1/sessions/${opts.sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          const r = await fetchJson<{ id: string; messages: ChatMessage[] }>(
            opts.apiBaseUrl,
            `/v1/sessions/${opts.sessionId}`,
          );
          setMessages(r.messages);
        } catch (e) {
          let msg = errorToBannerText(e);
          if (e instanceof ApiRequestError && e.code !== undefined) {
            msg = `[${e.code}] ${msg}`;
          }
          opts.onNotice(msg, "err");
        } finally {
          setBusy(false);
        }
        return;
      }

      setBusy(true);
      try {
        if (opts.bundleStore === null) {
          opts.onNotice(offlineUserBannerMessage(OFFLINE_USER_ERROR_CODES.OFFLINE_NO_STORE), "err");
          return;
        }
        const bundle = await opts.bundleStore.load();
        if (bundle === null || bundle.vectors.length === 0) {
          opts.onNotice(offlineUserBannerMessage(OFFLINE_USER_ERROR_CODES.OFFLINE_NO_BUNDLE), "err");
          return;
        }
        const trimmed = text.trim();
        const hist = messagesRef.current;
        const out = await runLocalRagTurn({ userText: trimmed, history: hist }, bundle);
        const tUser = new Date().toISOString();
        const tAsst = new Date().toISOString();
        const userMsg: ChatMessage = {
          id: mkMessageId(),
          role: "user",
          content: trimmed,
          createdAt: tUser,
        };
        const assistantMsg: ChatMessage = {
          id: mkMessageId(),
          role: "assistant",
          content: formatAssistantContent(out.answer, out.citations),
          createdAt: tAsst,
        };
        setMessages([...hist, userMsg, assistantMsg]);
      } catch (e) {
        const msg = errorToBannerText(e);
        opts.onNotice(offlineRagFailureUserBanner(msg), "err");
      } finally {
        setBusy(false);
      }
    },
    [opts.apiBaseUrl, opts.bundleStore, opts.effectiveOffline, opts.onNotice, opts.sessionId],
  );

  return { messages, busy, send };
}
