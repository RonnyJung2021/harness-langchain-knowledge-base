import { useCallback, useState } from "react";
import { errorToBannerText, fetchJson } from "./api";
import { ChatPanel } from "./ChatPanel";
import { ConnectionSelfCheck } from "./ConnectionSelfCheck";
import { KbReplacePanel } from "./KbReplacePanel";

type PostSession = { sessionId: string };

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [creating, setCreating] = useState(false);

  const onNotice = useCallback((msg: string, kind: "ok" | "err") => {
    setBanner({ text: msg, kind });
  }, []);

  const newSession = useCallback(async () => {
    setCreating(true);
    try {
      const s = await fetchJson<PostSession>("/v1/sessions", { method: "POST" });
      setSessionId(s.sessionId);
      setBanner({ text: `已创建会话，sessionId=${s.sessionId}`, kind: "ok" });
    } catch (e) {
      setBanner({ text: errorToBannerText(e), kind: "err" });
    } finally {
      setCreating(false);
    }
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>知识库 RAG（极简）</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 14 }}>
          <span>
            当前 session：<code>{sessionId ?? "（未创建）"}</code>
          </span>
          <button
            type="button"
            data-testid="btn-new-session"
            disabled={creating}
            title={creating ? "创建中…" : "创建新会话"}
            onClick={() => void newSession()}
          >
            {creating ? "创建中…" : "新会话"}
          </button>
        </div>
      </header>
      {banner !== null ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: 8,
            borderRadius: 6,
            background: banner.kind === "err" ? "#ffe8e8" : "#e8ffe8",
            border: `1px solid ${banner.kind === "err" ? "#f88" : "#8c8"}`,
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {banner.text}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ConnectionSelfCheck />
        <ChatPanel sessionId={sessionId} onNotice={onNotice} />
        <KbReplacePanel onNotice={onNotice} />
      </div>
    </div>
  );
}
