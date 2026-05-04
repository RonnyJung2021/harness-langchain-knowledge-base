import { useCallback, useState } from "react";
import { sanitizeForUi } from "./httpFeedback";

type StepResult = {
  name: string;
  ok: boolean;
  status: number;
  ms: number;
  detail: string;
};

async function runStep(
  name: string,
  fn: () => Promise<{ ok: boolean; status: number; detail: string }>,
): Promise<StepResult> {
  const t0 = performance.now();
  try {
    const r = await fn();
    const ms = Math.round(performance.now() - t0);
    return { name, ok: r.ok, status: r.status, ms, detail: sanitizeForUi(r.detail) };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      name,
      ok: false,
      status: 0,
      ms,
      detail: sanitizeForUi(`网络或异常：${msg}`),
    };
  }
}

export function ConnectionSelfCheck() {
  const [running, setRunning] = useState(false);
  const [withModelPing, setWithModelPing] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);

  const run = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    const out: StepResult[] = [];

    out.push(
      await runStep("GET /healthz", async () => {
        const r = await fetch("/healthz");
        const text = await r.text();
        return { ok: r.ok, status: r.status, detail: text.slice(0, 200) };
      }),
    );

    out.push(
      await runStep("GET /readyz", async () => {
        const r = await fetch("/readyz");
        const text = await r.text();
        return { ok: r.ok, status: r.status, detail: text.slice(0, 200) };
      }),
    );

    let sid = "";
    out.push(
      await runStep("POST /v1/sessions", async () => {
        const r = await fetch("/v1/sessions", { method: "POST" });
        const text = await r.text();
        if (r.ok) {
          try {
            const j = JSON.parse(text) as { sessionId?: string };
            if (typeof j.sessionId === "string") {
              sid = j.sessionId;
            }
          } catch {
            /* ignore */
          }
        }
        return { ok: r.ok, status: r.status, detail: text.slice(0, 300) };
      }),
    );

    if (sid !== "") {
      out.push(
        await runStep(`GET /v1/sessions/${sid.slice(0, 8)}…`, async () => {
          const r = await fetch(`/v1/sessions/${sid}`);
          const text = await r.text();
          return { ok: r.ok, status: r.status, detail: text.slice(0, 400) };
        }),
      );
    }

    if (withModelPing && sid !== "") {
      out.push(
        await runStep("POST /v1/sessions/…/messages（消耗方舟配额）", async () => {
          const r = await fetch(`/v1/sessions/${sid}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "连接自检：请仅回复「pong」。" }),
          });
          const text = await r.text();
          return { ok: r.ok, status: r.status, detail: text.slice(0, 500) };
        }),
      );
    }

    setSteps(out);
    setRunning(false);
  }, [withModelPing]);

  return (
    <section style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8 }}>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>连接自检</summary>
        <p style={{ fontSize: 12, color: "#555", margin: "8px 0" }}>
          顺序探测 API 可达性；默认<strong>不调用模型</strong>。勾选下方选项会发送一条真实对话（消耗方舟配额）。
        </p>
        <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={withModelPing}
            disabled={running}
            onChange={(e) => {
              setWithModelPing(e.target.checked);
            }}
          />
          包含一条模型调用（POST messages）
        </label>
        <button type="button" disabled={running} onClick={() => void run()}>
          {running ? "运行中…" : "运行自检"}
        </button>
        {steps.length > 0 ? (
          <table style={{ width: "100%", marginTop: 12, fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 4 }}>步骤</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 4 }}>结果</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 4 }}>HTTP</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 4 }}>耗时</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.name}>
                  <td style={{ padding: 6, verticalAlign: "top" }}>{s.name}</td>
                  <td style={{ padding: 6, verticalAlign: "top" }}>{s.ok ? "✓" : "✗"}</td>
                  <td style={{ padding: 6, verticalAlign: "top" }}>{String(s.status)}</td>
                  <td style={{ padding: 6, verticalAlign: "top", textAlign: "right" }}>{String(s.ms)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {steps.length > 0 ? (
          <div style={{ marginTop: 8, fontSize: 11, color: "#444" }}>
            {steps.map((s) => (
              <div key={`${s.name}-detail`} style={{ marginBottom: 6 }}>
                <strong>{s.name}</strong>：{s.detail}
              </div>
            ))}
          </div>
        ) : null}
      </details>
    </section>
  );
}
