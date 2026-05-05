import { useCallback, useState } from "react";
import { ActivityIndicator, Box, Pressable, ScrollView, Text } from "@kb-rag/design-system";
import { useTheme } from "@kb-rag/design-system";
import { sanitizeForUi } from "../httpFeedback.js";
import { joinApiPath } from "@kb-rag/shared";

type StepResult = {
  name: string;
  ok: boolean;
  status: number;
  ms: number;
  detail: string;
};

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

async function runStep(
  name: string,
  fn: () => Promise<{ ok: boolean; status: number; detail: string }>,
): Promise<StepResult> {
  const t0 = nowMs();
  try {
    const r = await fn();
    const ms = Math.round(nowMs() - t0);
    return { name, ok: r.ok, status: r.status, ms, detail: sanitizeForUi(r.detail) };
  } catch (e) {
    const ms = Math.round(nowMs() - t0);
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

export type DiagnosticsPanelProps = {
  /** 空字符串表示 fetch 同源相对路径（Web）；Native 填 `EXPO_PUBLIC_API_BASE_URL`。 */
  apiBaseUrl: string;
};

export function DiagnosticsPanel(props: DiagnosticsPanelProps) {
  const { tokens } = useTheme();
  const { apiBaseUrl } = props;
  const [running, setRunning] = useState(false);
  const [withModelPing, setWithModelPing] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);

  const url = useCallback(
    (path: string) => {
      const p = path.startsWith("/") ? path : `/${path}`;
      const j = joinApiPath(apiBaseUrl, p);
      return j;
    },
    [apiBaseUrl],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    const out: StepResult[] = [];

    out.push(
      await runStep("GET /healthz", async () => {
        const r = await fetch(url("/healthz"));
        const text = await r.text();
        return { ok: r.ok, status: r.status, detail: text.slice(0, 200) };
      }),
    );

    out.push(
      await runStep("GET /readyz", async () => {
        const r = await fetch(url("/readyz"));
        const text = await r.text();
        return { ok: r.ok, status: r.status, detail: text.slice(0, 200) };
      }),
    );

    let sid = "";
    out.push(
      await runStep("POST /v1/sessions", async () => {
        const r = await fetch(url("/v1/sessions"), { method: "POST" });
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
          const r = await fetch(url(`/v1/sessions/${sid}`));
          const text = await r.text();
          return { ok: r.ok, status: r.status, detail: text.slice(0, 400) };
        }),
      );
    }

    if (withModelPing && sid !== "") {
      out.push(
        await runStep("POST /v1/sessions/…/messages（消耗方舟配额）", async () => {
          const r = await fetch(url(`/v1/sessions/${sid}/messages`), {
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
  }, [url, withModelPing]);

  return (
    <Box
      style={{
        borderWidth: 1,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.md,
        padding: tokens.space.md,
        backgroundColor: tokens.colors.surface,
      }}
    >
      <Text style={{ fontSize: tokens.fontSize.md, fontWeight: "700", marginBottom: tokens.space.sm }}>
        连接自检
      </Text>
      <Text style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted, marginBottom: tokens.space.md }}>
        顺序探测 API；默认不调用模型。勾选下方会发送一条真实对话（消耗方舟配额）。
      </Text>
      <Pressable
        onPress={() => {
          setWithModelPing((v) => !v);
        }}
        disabled={running}
        style={{ flexDirection: "row", alignItems: "center", marginBottom: tokens.space.md, minHeight: tokens.touchTargetMin }}
      >
        <Text style={{ marginRight: tokens.space.sm }}>{withModelPing ? "☑" : "☐"}</Text>
        <Text style={{ fontSize: tokens.fontSize.sm }}>包含一条模型调用（POST messages）</Text>
      </Pressable>
      <Pressable
        onPress={() => void run()}
        disabled={running}
        style={{
          minHeight: tokens.touchTargetMin,
          paddingHorizontal: tokens.space.lg,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: tokens.colors.primary,
          borderRadius: tokens.radius.sm,
          opacity: running ? 0.6 : 1,
        }}
      >
        {running ? (
          <ActivityIndicator color={tokens.colors.primaryContrast} />
        ) : (
          <Text style={{ color: tokens.colors.primaryContrast, fontWeight: "600" }}>运行自检</Text>
        )}
      </Pressable>
      {steps.length > 0 ? (
        <ScrollView style={{ marginTop: tokens.space.md, maxHeight: 220 }}>
          {steps.map((s) => (
            <Box key={s.name} style={{ marginBottom: tokens.space.sm }}>
              <Text style={{ fontSize: tokens.fontSize.xs, fontWeight: "700" }}>
                {s.name} {s.ok ? "✓" : "✗"} HTTP {String(s.status)} {String(s.ms)} ms
              </Text>
              <Text style={{ fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted }}>{s.detail}</Text>
            </Box>
          ))}
        </ScrollView>
      ) : null}
    </Box>
  );
}
