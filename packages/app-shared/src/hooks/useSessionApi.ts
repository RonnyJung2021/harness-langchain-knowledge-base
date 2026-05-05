import { useCallback, useState } from "react";
import { fetchJson, errorToBannerText } from "../api/httpApi.js";

function newLocalSessionId(): string {
  const c = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (typeof c === "function") {
    return `local-${c()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useSessionApi(
  apiBaseUrl: string,
  onNotice: (msg: string, kind: "ok" | "err") => void,
): {
  sessionId: string | null;
  creating: boolean;
  newSession: () => Promise<void>;
  /** 仅客户端会话 id，不请求服务端；供有效离线时聊天使用。 */
  newLocalSession: () => void;
} {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const newLocalSession = useCallback(() => {
    const id = newLocalSessionId();
    setSessionId(id);
    onNotice(`已创建本地会话（仅本机，离线管道）：${id}`, "ok");
  }, [onNotice]);

  const newSession = useCallback(async () => {
    setCreating(true);
    try {
      const s = await fetchJson<{ sessionId: string }>(apiBaseUrl, "/v1/sessions", { method: "POST" });
      setSessionId(s.sessionId);
      onNotice(`已创建会话，sessionId=${s.sessionId}`, "ok");
    } catch (e) {
      onNotice(errorToBannerText(e), "err");
    } finally {
      setCreating(false);
    }
  }, [apiBaseUrl, onNotice]);

  return { sessionId, creating, newSession, newLocalSession };
}
