import { useCallback, useEffect, useRef, useState } from "react";
import { errorToBannerText, fetchJson, postSessionMessageStream } from "./api";
import type { ChatMessage, CitationSummary } from "./types";

type SessionGet = { id: string; messages: ChatMessage[] };

export type MessageView = ChatMessage & {
  citations?: CitationSummary[];
  degraded?: boolean;
};

type MsgResp = {
  answer: string;
  citations: CitationSummary[];
  degraded?: boolean;
};

function patchLastAssistantCitations(
  messages: ChatMessage[],
  citations: CitationSummary[],
  degraded?: boolean,
): MessageView[] {
  const out: MessageView[] = messages.map((m) => ({ ...m }));
  let lastAi = -1;
  for (let i = 0; i < out.length; i += 1) {
    if (out[i].role === "assistant") {
      lastAi = i;
    }
  }
  if (lastAi >= 0) {
    out[lastAi] = { ...out[lastAi], citations, degraded };
  }
  return out;
}

export function ChatPanel(props: {
  sessionId: string | null;
  onNotice: (msg: string, kind: "ok" | "err") => void;
}) {
  const { sessionId, onNotice } = props;
  const [rows, setRows] = useState<MessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  /** 勾选时使用 `POST .../messages:stream`（fetch + SSE）；否则沿用非流式 JSON。 */
  const [useStream, setUseStream] = useState(false);
  /** 流式进行中：展示用户句与当前已生成的助手片段（落盘仍以服务端 GET 为准）。 */
  const [streamPreview, setStreamPreview] = useState<{ userText: string; text: string } | null>(
    null,
  );
  const [okLine, setOkLine] = useState<string | null>(null);
  const okTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearOkTimer = useCallback(() => {
    if (okTimer.current !== undefined) {
      clearTimeout(okTimer.current);
      okTimer.current = undefined;
    }
  }, []);

  const reload = useCallback(async () => {
    if (sessionId === null) {
      setRows([]);
      return;
    }
    try {
      const s = await fetchJson<SessionGet>(`/v1/sessions/${sessionId}`);
      setRows(s.messages.map((m) => ({ ...m })));
    } catch (e) {
      onNotice(errorToBannerText(e), "err");
    }
  }, [sessionId, onNotice]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return () => {
      clearOkTimer();
    };
  }, [clearOkTimer]);

  const send = useCallback(async () => {
    if (sessionId === null) {
      onNotice("请先点击「新会话」再发送消息。", "err");
      return;
    }
    const text = draft.trim();
    if (text === "") {
      return;
    }
    setSending(true);
    setDraft("");
    try {
      if (useStream) {
        setStreamPreview({ userText: text, text: "" });
        const out = await postSessionMessageStream(sessionId, text, (delta) => {
          setStreamPreview((p) => (p === null ? p : { ...p, text: p.text + delta }));
        });
        setStreamPreview(null);
        const s = await fetchJson<SessionGet>(`/v1/sessions/${sessionId}`);
        setRows(patchLastAssistantCitations(s.messages, out.citations, out.degraded));
        clearOkTimer();
        setOkLine(
          `已发送（流式）。当前会话共 ${String(s.messages.length)} 条消息；本轮引用 ${String(out.citations.length)} 条。`,
        );
        okTimer.current = setTimeout(() => setOkLine(null), 6000);
      } else {
        const out = await fetchJson<MsgResp>(`/v1/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const s = await fetchJson<SessionGet>(`/v1/sessions/${sessionId}`);
        setRows(patchLastAssistantCitations(s.messages, out.citations, out.degraded));
        clearOkTimer();
        setOkLine(
          `已发送。当前会话共 ${String(s.messages.length)} 条消息；本轮引用 ${String(out.citations.length)} 条。`,
        );
        okTimer.current = setTimeout(() => setOkLine(null), 6000);
      }
    } catch (e) {
      setStreamPreview(null);
      onNotice(errorToBannerText(e), "err");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [clearOkTimer, draft, onNotice, sessionId, useStream]);

  const noSession = sessionId === null;

  return (
    <section style={{ flex: 1, border: "1px solid #ccc", padding: 12, borderRadius: 8, minWidth: 0 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>对话</h2>
      {noSession ? (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#a44" }}>
          请先点击上方「新会话」；未创建会话时无法发送。
        </p>
      ) : null}
      {okLine !== null ? (
        <div
          role="status"
          style={{
            marginBottom: 8,
            padding: 8,
            borderRadius: 6,
            background: "#e8f6ff",
            border: "1px solid #8ac",
            fontSize: 13,
          }}
        >
          {okLine}
        </div>
      ) : null}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 6,
          padding: 8,
          minHeight: 240,
          maxHeight: 420,
          overflowY: "auto",
          marginBottom: 8,
          background: "#fafafa",
        }}
      >
        {rows.length === 0 && streamPreview === null ? (
          <p style={{ color: "#888", margin: 0 }}>暂无消息。</p>
        ) : null}
        {rows.map((m) => (
            <div
              key={m.id}
              style={{ marginBottom: 12 }}
              data-testid={m.role === "assistant" ? "assistant-message" : undefined}
            >
              <div style={{ fontSize: 11, color: "#666" }}>
                {m.role} · {m.createdAt}
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{m.content}</div>
              {m.role === "assistant" && m.citations !== undefined && m.citations.length > 0 ? (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12 }}>
                    引用（{m.citations.length}）
                    {m.degraded === true ? " · degraded" : ""}
                  </summary>
                  <ol style={{ fontSize: 12, paddingLeft: 18, margin: "6px 0 0" }}>
                    {m.citations.map((c) => (
                      <li key={c.index}>
                        [{c.index}] {c.sourceFile} · {String(c.chunkIndex)} · score {c.score.toFixed(4)}
                        <div style={{ color: "#555" }}>{c.preview80}</div>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          ))}
        {streamPreview !== null ? (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #ccc" }}>
            <div style={{ fontSize: 11, color: "#666" }}>user · 流式预览</div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{streamPreview.userText}</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>assistant · 生成中</div>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }} data-testid="stream-preview">
              {streamPreview.text.length > 0 ? streamPreview.text : "…"}
            </div>
          </div>
        ) : null}
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
          fontSize: 13,
          cursor: noSession ? "not-allowed" : "pointer",
          color: noSession ? "#999" : undefined,
        }}
      >
        <input
          type="checkbox"
          checked={useStream}
          disabled={noSession || sending}
          onChange={(e) => {
            setUseStream(e.target.checked);
          }}
        />
        流式输出（SSE，POST …/messages:stream）
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          data-testid="chat-input"
          style={{ flex: 1, padding: 8 }}
          placeholder={noSession ? "请先创建会话" : "输入后回车发送"}
          value={draft}
          disabled={sending || noSession}
          title={noSession ? "请先点击「新会话」" : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          data-testid="btn-send"
          disabled={sending || noSession}
          title={noSession ? "请先创建会话" : sending ? "发送中…" : "发送"}
          onClick={() => void send()}
        >
          {sending ? "发送中…" : "发送"}
        </button>
      </div>
    </section>
  );
}
