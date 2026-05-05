import type { ChatMessage, PostSessionMessageResponseBody } from "@kb-rag/shared";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, errorToBannerText, fetchJson } from "../api/httpApi.js";

export function useChatPanel(opts: {
  apiBaseUrl: string;
  sessionId: string | null;
  onNotice: (msg: string, kind: "ok" | "err") => void;
}): {
  messages: ChatMessage[];
  busy: boolean;
  send: (text: string) => Promise<void>;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
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
  }, [opts.sessionId, opts.apiBaseUrl, opts.onNotice]);

  const send = useCallback(
    async (text: string) => {
      if (opts.sessionId === null || text.trim() === "") {
        return;
      }
      setBusy(true);
      try {
        await fetchJson<PostSessionMessageResponseBody>(
          opts.apiBaseUrl,
          `/v1/sessions/${opts.sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          },
        );
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
    },
    [opts.sessionId, opts.apiBaseUrl, opts.onNotice],
  );

  return { messages, busy, send };
}
