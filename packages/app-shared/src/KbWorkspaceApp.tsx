import { useCallback, useState } from "react";
import { Box, Pressable, ScrollView, Text } from "@kb-rag/design-system";
import { ThemeProvider, useTheme } from "@kb-rag/design-system";
import type { PdfFileLike } from "./hooks/useKbReplace.js";
import { useChatPanel } from "./hooks/useChatPanel.js";
import { useSessionApi } from "./hooks/useSessionApi.js";
import { ChatPanel } from "./panels/ChatPanel.js";
import { DiagnosticsPanel } from "./panels/DiagnosticsPanel.js";
import { KbReplacePanel } from "./panels/KbReplacePanel.js";

export type KbWorkspaceAppProps = {
  /** 浏览器同源填空字符串；Expo 填 `process.env.EXPO_PUBLIC_API_BASE_URL`。 */
  apiBaseUrl: string;
  /** 与 HTTP_ADMIN_TOKEN 对应的 Bearer（勿打入公开仓库）。 */
  adminToken?: string;
  pickPdfFile: () => Promise<PdfFileLike | null>;
};

function KbWorkspaceInner(props: KbWorkspaceAppProps) {
  const { tokens } = useTheme();
  const { apiBaseUrl, adminToken, pickPdfFile } = props;
  const [banner, setBanner] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  const onNotice = useCallback((msg: string, kind: "ok" | "err") => {
    setBanner({ text: msg, kind });
  }, []);

  const session = useSessionApi(apiBaseUrl, onNotice);
  const chat = useChatPanel({
    apiBaseUrl,
    sessionId: session.sessionId,
    onNotice,
  });

  return (
    <Box style={{ flex: 1, backgroundColor: tokens.colors.background, padding: tokens.space.md }}>
      <ScrollView
        style={{ flexGrow: 0 }}
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
          onPress={() => void session.newSession()}
          disabled={session.creating}
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
          <Text style={{ fontWeight: "700" }}>{session.creating ? "创建中…" : "新会话"}</Text>
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
            PWA（占位）：可离线加载静态外壳；问答仍依赖后端 /v1 或后续 RN 客户端扩展离线推理。
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
          <DiagnosticsPanel apiBaseUrl={apiBaseUrl} />
        </Box>

        <KbReplacePanel
          apiBaseUrl={apiBaseUrl}
          adminToken={adminToken}
          onNotice={onNotice}
          pickPdfFile={pickPdfFile}
        />
      </ScrollView>

      <Box style={{ flex: 1, marginTop: tokens.space.sm, minHeight: 220 }}>
        <ChatPanel
          messages={chat.messages}
          busy={chat.busy}
          sessionReady={session.sessionId !== null}
          onSend={chat.send}
        />
      </Box>
    </Box>
  );
}

export function KbWorkspaceApp(props: KbWorkspaceAppProps) {
  return (
    <ThemeProvider>
      <KbWorkspaceInner {...props} />
    </ThemeProvider>
  );
}
