import { useCallback, useState } from "react";
import { Platform, Switch } from "react-native";
import { ActivityIndicator, Box, Pressable, ScrollView, Text } from "@kb-rag/design-system";
import { useTheme } from "@kb-rag/design-system";
import type { KbBundleStore } from "@kb-rag/client-offline-core";
import { sanitizeForUi } from "../httpFeedback.js";
import { joinApiPath, OFFLINE_USER_ERROR_CODES, offlineUserBannerMessage } from "@kb-rag/shared";
import {
  kbBundleSyncErrorToUserMessage,
  syncKbBundleFromServer,
} from "../offline/syncKbBundle.js";
import { useOfflinePreference } from "../offline/OfflinePreferenceProvider.js";
import { useLikelyOnline } from "../offline/useLikelyOnline.js";
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
      /network|fetch failed|failed to fetch|load failed|internet connection|offline|unreachable|主动离线|有效离线|飞行模式/i.test(
        low,
      )
        ? "（常见：飞行模式、主动/有效离线、局域网不可达，或 EXPO_PUBLIC_API_BASE_URL 指向错误）"
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
  /** 与 `HTTP_ADMIN_TOKEN` 一致；用于 `GET /v1/knowledge-base/bundle`。 */
  adminToken?: string;
  /** 未注入时隐藏「同步到本机」能力（仅展示说明）。 */
  kbBundleStore?: KbBundleStore | null;
};

export function DiagnosticsPanel(props: DiagnosticsPanelProps) {
  const { tokens } = useTheme();
  const { apiBaseUrl, adminToken, kbBundleStore } = props;
  const [running, setRunning] = useState(false);
  const [withShortMessage, setWithShortMessage] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncLine, setSyncLine] = useState<string | null>(null);
  const likelyOnline = useLikelyOnline();
  const { preferOffline, setPreferOffline, hydrated: offlinePrefHydrated } = useOfflinePreference();

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
  const adminTrimmed = adminToken?.trim() ?? "";
  const missingAdmin = adminTrimmed === "";
  const hasStore = kbBundleStore !== undefined && kbBundleStore !== null;

  const onSyncKbBundle = useCallback(async () => {
    if (!hasStore || kbBundleStore === null || kbBundleStore === undefined) {
      return;
    }
    if (missingAdmin) {
      setSyncLine("未配置 Admin Token，无法请求受保护接口。");
      return;
    }
    setSyncBusy(true);
    setSyncLine(null);
    try {
      await syncKbBundleFromServer(apiBaseUrl, adminTrimmed, kbBundleStore);
      const loaded = await kbBundleStore.load();
      const n = loaded?.vectors.length ?? 0;
      setSyncLine(`同步成功：已写入本机（vectors=${String(n)}）。`);
    } catch (e) {
      setSyncLine(
        `${offlineUserBannerMessage(OFFLINE_USER_ERROR_CODES.OFFLINE_SYNC_FAILED)} ${kbBundleSyncErrorToUserMessage(e)}`,
      );
    } finally {
      setSyncBusy(false);
    }
  }, [adminTrimmed, apiBaseUrl, hasStore, kbBundleStore, missingAdmin]);

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

      <Box
        style={{
          marginBottom: tokens.space.md,
          paddingBottom: tokens.space.md,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border,
        }}
      >
        <Text style={{ fontSize: tokens.fontSize.sm, fontWeight: "700", marginBottom: tokens.space.xs }}>
          客户端管道（非服务端状态）
        </Text>
        <Text
          style={{
            fontSize: tokens.fontSize.xs,
            color: tokens.colors.textMuted,
            marginBottom: tokens.space.sm,
            lineHeight: 18,
          }}
        >
          与下方「运行自检」中的 GET /v1/runtime-info 等探测解耦：runtime-info 描述服务端；本开关仅决定本机是否优先走离线问答管道。主动离线仍须先在下方「同步知识库到本机」；生成阶段为降级占位（stub），与 README
          离线说明一致。
        </Text>
        <Box style={{ flexDirection: "row", alignItems: "center", minHeight: tokens.touchTargetMin }}>
          <Text style={{ flex: 1, fontSize: tokens.fontSize.sm, marginRight: tokens.space.sm }}>
            主动使用离线模式
          </Text>
          <Switch
            value={preferOffline}
            disabled={!offlinePrefHydrated}
            onValueChange={(v) => {
              setPreferOffline(v);
            }}
          />
        </Box>
      </Box>

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

      {likelyOnline && !nativeMissingBase ? (
        <Box
          style={{
            marginTop: tokens.space.md,
            paddingTop: tokens.space.md,
            borderTopWidth: 1,
            borderTopColor: tokens.colors.border,
          }}
        >
          <Text style={{ fontSize: tokens.fontSize.sm, fontWeight: "700", marginBottom: tokens.space.xs }}>
            知识库离线包
          </Text>
          <Text
            style={{
              fontSize: tokens.fontSize.xs,
              color: tokens.colors.textMuted,
              marginBottom: tokens.space.sm,
            }}
          >
            在线时可将服务端快照同步到本机存储，供后续离线 RAG 使用（需 Admin Token）。
          </Text>
          {!hasStore ? (
            <Text style={{ fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted }}>
              当前未注入 KbBundleStore，宿主（如 RN）需在根组件传入 store。
            </Text>
          ) : (
            <>
              <Pressable
                onPress={() => void onSyncKbBundle()}
                disabled={syncBusy || missingAdmin}
                style={{
                  minHeight: tokens.touchTargetMin,
                  paddingHorizontal: tokens.space.lg,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border,
                  borderRadius: tokens.radius.sm,
                  opacity: syncBusy || missingAdmin ? 0.55 : 1,
                }}
              >
                {syncBusy ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={{ fontWeight: "600" }}>同步知识库到本机</Text>
                )}
              </Pressable>
              {missingAdmin ? (
                <Text
                  style={{
                    fontSize: tokens.fontSize.xs,
                    color: tokens.colors.errorText,
                    marginTop: tokens.space.xs,
                  }}
                >
                  未配置 Admin Token（Web 环境变量 / Native EXPO_PUBLIC_HTTP_ADMIN_TOKEN）。
                </Text>
              ) : null}
              {syncLine !== null ? (
                <Text
                  style={{
                    fontSize: tokens.fontSize.xs,
                    color: tokens.colors.textMuted,
                    marginTop: tokens.space.sm,
                  }}
                  selectable
                >
                  {syncLine}
                </Text>
              ) : null}
            </>
          )}
        </Box>
      ) : null}

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
