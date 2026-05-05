import { useCallback, useEffect, useState } from "react";
import { Box, Pressable, ScrollView, Text } from "@kb-rag/design-system";
import { ThemeProvider, useTheme } from "@kb-rag/design-system";
import type { PdfFileLike } from "./hooks/useKbReplace.js";
import { useChatPanelDualMode } from "./hooks/useChatPanelDualMode.js";
import { useSessionApi } from "./hooks/useSessionApi.js";
import { composerSafeBottomStyle } from "./layout/composerSafeBottom.js";
import {
  useWorkspaceLayout,
  WORKSPACE_SHELL_MAX_WIDTH_PX,
} from "./layout/workspaceResponsive.js";
import { warnIfNativeMissingApiBase } from "./config/nativeApiGuard.js";
import { KbBundleStoreProvider } from "./context/KbBundleStoreContext.js";
import type { KbBundleStore } from "@kb-rag/client-offline-core";
import { OfflinePreferenceProvider, useOfflinePreference } from "./offline/OfflinePreferenceProvider.js";
import { useEffectiveOffline } from "./offline/useEffectiveOffline.js";
import { ChatPanel } from "./panels/ChatPanel.js";
import { DiagnosticsPanel } from "./panels/DiagnosticsPanel.js";
import { KbReplacePanel } from "./panels/KbReplacePanel.js";

export type KbWorkspaceAppProps = {
  /** 浏览器同源填空字符串；Expo 填 `process.env.EXPO_PUBLIC_API_BASE_URL`。 */
  apiBaseUrl: string;
  /** 与 HTTP_ADMIN_TOKEN 对应的 Bearer（勿打入公开仓库）。 */
  adminToken?: string;
  pickPdfFile: () => Promise<PdfFileLike | null>;
  /**
   * 端内知识库快照持久化（如 RN `KbBundleStore`）；由宿主注入，不在 `@kb-rag/client-offline-core` 内依赖 Expo。
   */
  kbBundleStore?: KbBundleStore | null;
};

type CompactTab = "chat" | "tools";

function ToolsStack(props: {
  apiBaseUrl: string;
  adminToken?: string;
  kbBundleStore?: KbBundleStore | null;
  pickPdfFile: () => Promise<PdfFileLike | null>;
  session: ReturnType<typeof useSessionApi>;
  banner: { text: string; kind: "ok" | "err" } | null;
  onNotice: (msg: string, kind: "ok" | "err") => void;
  effectiveOffline: boolean;
  /** 小屏「工具」Tab 占满剩余高度 */
  fillAvailable?: boolean;
}) {
  const { tokens } = useTheme();
  const {
    apiBaseUrl,
    adminToken,
    kbBundleStore,
    pickPdfFile,
    session,
    banner,
    onNotice,
    effectiveOffline,
    fillAvailable,
  } = props;

  const onNewSession = (): void => {
    if (effectiveOffline) {
      session.newLocalSession();
      return;
    }
    void session.newSession();
  };

  return (
    <ScrollView
      style={fillAvailable === true ? { flex: 1 } : { flexGrow: 0 }}
      contentContainerStyle={{ paddingBottom: tokens.space.md }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: tokens.fontSize.title, fontWeight: "800", marginBottom: tokens.space.sm }}>
        知识库 RAG
      </Text>
      <Text
        style={{
          fontSize: tokens.fontSize.sm,
          color: tokens.colors.textMuted,
          marginBottom: tokens.space.md,
        }}
        selectable
      >
        当前 session：{session.sessionId ?? "（未创建）"}
      </Text>
      <Pressable
        onPress={onNewSession}
        disabled={session.creating && !effectiveOffline}
        style={{
          minHeight: tokens.touchTargetMin,
          marginBottom: tokens.space.md,
          paddingHorizontal: tokens.space.lg,
          justifyContent: "center",
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.sm,
        }}
      >
        <Text style={{ fontWeight: "700" }}>
          {session.creating && !effectiveOffline ? "创建中…" : effectiveOffline ? "新本地会话" : "新会话"}
        </Text>
      </Pressable>

      <Box
        style={{
          marginBottom: tokens.space.md,
          padding: tokens.space.sm,
          borderRadius: tokens.radius.sm,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: tokens.colors.border,
        }}
      >
        <Text style={{ fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted, lineHeight: 18 }}>
          {effectiveOffline
            ? "当前为有效离线：对话走本机 RAG（须已同步知识库）；回复为占位 stub，与 README 离线说明一致。"
            : "在线时对话走后端 /v1；勾选「主动使用离线模式」并创建本地会话后可不依赖网络发消息。"}
        </Text>
      </Box>

      {banner !== null ? (
        <Box
          style={{
            marginBottom: tokens.space.md,
            padding: tokens.space.sm,
            borderRadius: tokens.radius.sm,
            backgroundColor: banner.kind === "err" ? tokens.colors.errorBg : tokens.colors.successBg,
            borderWidth: 1,
            borderColor: banner.kind === "err" ? tokens.colors.errorBorder : tokens.colors.successBorder,
          }}
        >
          <Text style={{ fontSize: tokens.fontSize.sm }}>{banner.text}</Text>
        </Box>
      ) : null}

      <Box style={{ marginBottom: tokens.space.md }}>
        <DiagnosticsPanel apiBaseUrl={apiBaseUrl} adminToken={adminToken} kbBundleStore={kbBundleStore} />
      </Box>

      <KbReplacePanel
        apiBaseUrl={apiBaseUrl}
        adminToken={adminToken}
        onNotice={onNotice}
        pickPdfFile={pickPdfFile}
      />
    </ScrollView>
  );
}

function KbWorkspaceInner(props: KbWorkspaceAppProps) {
  const { tokens } = useTheme();
  const { variant } = useWorkspaceLayout();
  const { apiBaseUrl, adminToken, kbBundleStore, pickPdfFile } = props;
  const [banner, setBanner] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [compactTab, setCompactTab] = useState<CompactTab>("chat");
  const { preferOffline } = useOfflinePreference();
  const effectiveOffline = useEffectiveOffline(preferOffline);

  const onNotice = useCallback((msg: string, kind: "ok" | "err") => {
    setBanner({ text: msg, kind });
  }, []);

  useEffect(() => {
    const w = warnIfNativeMissingApiBase(apiBaseUrl);
    if (w !== null) {
      onNotice(w, "err");
    }
  }, [apiBaseUrl, onNotice]);

  const session = useSessionApi(apiBaseUrl, onNotice);
  const chat = useChatPanelDualMode({
    apiBaseUrl,
    sessionId: session.sessionId,
    effectiveOffline,
    bundleStore: kbBundleStore ?? null,
    onNotice,
  });

  const padX = variant === "wide" ? tokens.space.md : tokens.space.sm;

  const innerShellStyle =
    variant === "wide"
      ? ({
          flex: 1,
          width: "100%",
          maxWidth: WORKSPACE_SHELL_MAX_WIDTH_PX,
          alignSelf: "center",
          paddingHorizontal: padX,
          paddingTop: tokens.space.sm,
        } as const)
      : ({
          flex: 1,
          width: "100%",
          paddingHorizontal: padX,
          paddingTop: tokens.space.sm,
        } as const);

  const toolsPropsBase = {
    apiBaseUrl,
    adminToken,
    kbBundleStore,
    pickPdfFile,
    session,
    banner,
    onNotice,
    effectiveOffline,
  };

  const onCompactNewSession = (): void => {
    if (effectiveOffline) {
      session.newLocalSession();
      return;
    }
    void session.newSession();
  };

  return (
    <Box
      style={{
        flex: 1,
        width: "100%",
        backgroundColor: tokens.colors.background,
        overflow: "hidden",
      }}
    >
      <Box style={innerShellStyle}>
        {variant === "wide" ? (
          <>
            <ToolsStack {...toolsPropsBase} />
            <Box style={{ flex: 1, marginTop: tokens.space.sm, minHeight: 220 }}>
              <ChatPanel
                messages={chat.messages}
                busy={chat.busy}
                sessionReady={session.sessionId !== null}
                onSend={chat.send}
                composerUsesViewportSafeBottom
              />
            </Box>
          </>
        ) : (
          <>
            <Box style={{ flex: 1, minHeight: 0 }}>
              {compactTab === "tools" ? (
                <ToolsStack {...toolsPropsBase} fillAvailable />
              ) : (
                <Box style={{ flex: 1 }}>
                  <Box
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: tokens.space.sm,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        minWidth: 120,
                        fontSize: tokens.fontSize.sm,
                        color: tokens.colors.textMuted,
                        marginRight: tokens.space.sm,
                      }}
                      numberOfLines={1}
                      selectable
                    >
                      {session.sessionId ?? "（未创建会话）"}
                    </Text>
                    <Pressable
                      onPress={onCompactNewSession}
                      disabled={session.creating && !effectiveOffline}
                      style={{
                        minHeight: tokens.touchTargetMin,
                        paddingHorizontal: tokens.space.md,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: tokens.colors.surface,
                        borderWidth: 1,
                        borderColor: tokens.colors.border,
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      <Text style={{ fontWeight: "700" }}>
                        {session.creating && !effectiveOffline ? "创建中…" : effectiveOffline ? "本地会话" : "新会话"}
                      </Text>
                    </Pressable>
                  </Box>
                  <ChatPanel
                    messages={chat.messages}
                    busy={chat.busy}
                    sessionReady={session.sessionId !== null}
                    onSend={chat.send}
                    composerUsesViewportSafeBottom={false}
                  />
                </Box>
              )}
            </Box>

            <Box
              style={{
                flexDirection: "row",
                borderTopWidth: 1,
                borderTopColor: tokens.colors.border,
                backgroundColor: tokens.colors.surface,
                paddingTop: tokens.space.xs,
                ...composerSafeBottomStyle(),
              }}
            >
              <Pressable
                onPress={() => {
                  setCompactTab("chat");
                }}
                style={{
                  flex: 1,
                  minHeight: tokens.touchTargetMin,
                  justifyContent: "center",
                  alignItems: "center",
                  borderBottomWidth: compactTab === "chat" ? 2 : 0,
                  borderBottomColor: tokens.colors.primary,
                }}
              >
                <Text
                  style={{
                    fontWeight: compactTab === "chat" ? "800" : "600",
                    fontSize: tokens.fontSize.sm,
                    color: compactTab === "chat" ? tokens.colors.primary : tokens.colors.textMuted,
                  }}
                >
                  对话
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setCompactTab("tools");
                }}
                style={{
                  flex: 1,
                  minHeight: tokens.touchTargetMin,
                  justifyContent: "center",
                  alignItems: "center",
                  borderBottomWidth: compactTab === "tools" ? 2 : 0,
                  borderBottomColor: tokens.colors.primary,
                }}
              >
                <Text
                  style={{
                    fontWeight: compactTab === "tools" ? "800" : "600",
                    fontSize: tokens.fontSize.sm,
                    color: compactTab === "tools" ? tokens.colors.primary : tokens.colors.textMuted,
                  }}
                >
                  工具
                </Text>
              </Pressable>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

export function KbWorkspaceApp(props: KbWorkspaceAppProps) {
  const { kbBundleStore, ...innerProps } = props;
  return (
    <ThemeProvider colorScheme="light">
      <KbBundleStoreProvider value={kbBundleStore ?? null}>
        <OfflinePreferenceProvider>
          <KbWorkspaceInner {...innerProps} kbBundleStore={kbBundleStore} />
        </OfflinePreferenceProvider>
      </KbBundleStoreProvider>
    </ThemeProvider>
  );
}
