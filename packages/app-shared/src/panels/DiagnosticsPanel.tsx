import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { ActivityIndicator, Box, Pressable, ScrollView, Text } from "@kb-rag/design-system";
import { useTheme } from "@kb-rag/design-system";
import { sanitizeForUi } from "../httpFeedback.js";
import { joinApiPath } from "@kb-rag/shared";
import {
  formatDiagnosticsApiBaseUrl,
  parseHttpBodyForDiagnostics,
  type ParsedHttpDetail,
} from "./diagnosticsHelpers.js";

type StepResult = {
  name: string;
  ok: boolean;
  status: number;
  ms: number;
  detail: string;
  /** 响应 JSON `error.code`（若有） */
  bizCode?: string;
};

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function mergeDetail(parsed: ParsedHttpDetail, fallback: string): { detail: string; bizCode?: string } {
  const detail = parsed.detail.length > 0 ? parsed.detail : sanitizeForUi(fallback);
  return { detail, bizCode: parsed.bizCode };
}

async function runStep(
  name: string,
  fn: () => Promise<{ ok: boolean; status: number; detail: string; bizCode?: string }>,
): Promise<StepResult> {
  const t0 = nowMs();
  try {
    const r = await fn();
    const ms = Math.round(nowMs() - t0);
    return { name, ok: r.ok, status: r.status, ms, detail: r.detail, bizCode: r.bizCode };
  } catch (e) {
    const ms = Math.round(nowMs() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    const low = msg.toLowerCase();
    const netHint =
      Platform.OS !== "web" &&
      /network|fetch failed|failed to fetch|load failed|internet connection|offline|unreachable/i.test(
        low,
      )
        ? "（常见：飞行模式、局域网不可达、或 EXPO_PUBLIC_API_BASE_URL 指向错误）"
        : "";
    return {
      name,
      ok: false,
      status: 0,
      ms,
      detail: sanitizeForUi(`无法完成请求：${msg}${netHint}`),
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
  const [withShortMessage, setWithShortMessage] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);

  const url = useCallback(
    (path: string) => {
      const p = path.startsWith("/") ? path : `/${path}`;
      return joinApiPath(apiBaseUrl, p);
    },
    [apiBaseUrl],
  );

  const apiDisplay = formatDiagnosticsApiBaseUrl(apiBaseUrl);
  const nativeMissingBase =
    Platform.OS !== "web" && apiBaseUrl.trim() === "";

  const run = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    const out: StepResult[] = [];

    out.push(
      await runStep("GET /healthz", async () => {
        const r = await fetch(url("/healthz"));
        const text = await r.text();
        const parsed = parseHttpBodyForDiagnostics(text);
        const { detail, bizCode } = mergeDetail(parsed, text);
        return { ok: r.ok, status: r.status, detail, bizCode };
      }),
    );

    out.push(
      await runStep("GET /v1/runtime-info", async () => {
        const r = await fetch(url("/v1/runtime-info"));
        const text = await r.text();
        if (r.status === 404) {
          return {
            ok: false,
            status: 404,
            detail: sanitizeForUi(
              "服务端未提供 /v1/runtime-info（可选端点；可升级服务端或忽略本步）。",
            ),
          };
        }
        const parsed = parseHttpBodyForDiagnostics(text);
        const { detail, bizCode } = mergeDetail(parsed, text);
        return { ok: r.ok, status: r.status, detail, bizCode };
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
        const parsed = parseHttpBodyForDiagnostics(text);
        const { detail, bizCode } = mergeDetail(parsed, text);
        return { ok: r.ok, status: r.status, detail, bizCode };
      }),
    );

    if (sid !== "") {
      out.push(
        await runStep(`GET /v1/sessions/${sid.slice(0, 8)}…`, async () => {
          const r = await fetch(url(`/v1/sessions/${sid}`));
          const text = await r.text();
          const parsed = parseHttpBodyForDiagnostics(text);
          const { detail, bizCode } = mergeDetail(parsed, text);
          return { ok: r.ok, status: r.status, detail, bizCode };
        }),
      );
    }

    if (withShortMessage && sid !== "") {
      out.push(
        await runStep("POST …/messages（短消息，可能消耗模型配额）", async () => {
          const r = await fetch(url(`/v1/sessions/${sid}/messages`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "ping" }),
          });
          const text = await r.text();
          const parsed = parseHttpBodyForDiagnostics(text);
          const { detail, bizCode } = mergeDetail(parsed, text);
          return { ok: r.ok, status: r.status, detail, bizCode };
        }),
      );
    }

    setSteps(out);
    setRunning(false);
  }, [url, withShortMessage]);

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
      <Text
        style={{
          fontSize: tokens.fontSize.xs,
          color: tokens.colors.textMuted,
          marginBottom: tokens.space.sm,
        }}
        selectable
      >
        API：{apiDisplay}
        {Platform.OS !== "web" ? ` · ${Platform.OS}` : ""}
      </Text>
      {nativeMissingBase ? (
        <Text
          style={{
            fontSize: tokens.fontSize.xs,
            color: tokens.colors.errorText,
            marginBottom: tokens.space.sm,
          }}
        >
          Native 未配置 EXPO_PUBLIC_API_BASE_URL 时无法访问后端；下方步骤将显示网络失败。
        </Text>
      ) : null}
      <Text style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted, marginBottom: tokens.space.md }}>
        顺序：GET /healthz → GET /v1/runtime-info（不存在则本步 404 说明）→ POST /v1/sessions → GET
        会话；可选发送一条短消息。每步展示耗时与 HTTP 状态；JSON 错误含 error.code 时会单独标出。
      </Text>
      <Pressable
        onPress={() => {
          setWithShortMessage((v) => !v);
        }}
        disabled={running}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: tokens.space.md,
          minHeight: tokens.touchTargetMin,
        }}
      >
        <Text style={{ marginRight: tokens.space.sm }}>{withShortMessage ? "☑" : "☐"}</Text>
        <Text style={{ fontSize: tokens.fontSize.sm }}>发送一条短消息（POST …/messages）</Text>
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
        <ScrollView style={{ marginTop: tokens.space.md, maxHeight: 280 }}>
          {steps.map((s) => (
            <Box key={s.name} style={{ marginBottom: tokens.space.sm }}>
              <Text style={{ fontSize: tokens.fontSize.xs, fontWeight: "700" }}>
                {s.name} {s.ok ? "✓" : "✗"} HTTP {String(s.status)} · {String(s.ms)} ms
                {s.bizCode !== undefined ? ` · code=${sanitizeForUi(s.bizCode)}` : ""}
              </Text>
              <Text
                style={{ fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted }}
                selectable
              >
                {s.detail}
              </Text>
            </Box>
          ))}
        </ScrollView>
      ) : null}
    </Box>
  );
}
