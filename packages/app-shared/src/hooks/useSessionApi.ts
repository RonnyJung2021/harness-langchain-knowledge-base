import { useCallback, useState } from "react";
import { fetchJson, errorToBannerText } from "../api/httpApi.js";

export function useSessionApi(
  apiBaseUrl: string,
  onNotice: (msg: string, kind: "ok" | "err") => void,
): {
  sessionId: string | null;
  creating: boolean;
  newSession: () => Promise<void>;
} {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  return { sessionId, creating, newSession };
}
