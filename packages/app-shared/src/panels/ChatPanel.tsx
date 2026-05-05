import { useCallback, useState } from "react";
import { Box, Pressable, ScrollView, Text, TextInput } from "@kb-rag/design-system";
import { useTheme } from "@kb-rag/design-system";
import type { ChatMessage } from "@kb-rag/shared";
import { composerSafeBottomStyle } from "../layout/composerSafeBottom.js";

export type ChatPanelProps = {
  messages: ChatMessage[];
  busy: boolean;
  sessionReady: boolean;
  onSend: (text: string) => Promise<void>;
  /**
   * Web 宽屏：输入条使用 `env(safe-area-inset-bottom)`。
   * 紧凑布局底部另有 Tab 条承担安全区时设为 false，避免双重留白。
   */
  composerUsesViewportSafeBottom?: boolean;
};

export function ChatPanel(props: ChatPanelProps) {
  const { tokens } = useTheme();
  const { messages, busy, sessionReady, onSend, composerUsesViewportSafeBottom = true } = props;
  const [draft, setDraft] = useState("");

  const submit = useCallback(async () => {
    const t = draft.trim();
    if (t === "" || busy || !sessionReady) {
      return;
    }
    setDraft("");
    await onSend(t);
  }, [busy, draft, onSend, sessionReady]);

  return (
    <Box style={{ flex: 1, minHeight: 200 }}>
      <ScrollView style={{ flex: 1, marginBottom: tokens.space.sm }}>
        {messages.length === 0 ? (
          <Text style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted }}>
            {sessionReady ? "暂无消息，输入问题开始。" : "请先创建会话。"}
          </Text>
        ) : (
          messages.map((m) => (
            <Box
              key={m.id}
              style={{
                marginBottom: tokens.space.sm,
                padding: tokens.space.sm,
                borderRadius: tokens.radius.sm,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                flexShrink: 1,
                backgroundColor: m.role === "user" ? tokens.colors.userBubble : tokens.colors.assistantBubble,
              }}
            >
              <Text style={{ fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted, marginBottom: 4 }}>
                {m.role}
              </Text>
              <Text style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.text, flexShrink: 1 }}>
                {m.content}
              </Text>
            </Box>
          ))
        )}
      </ScrollView>
      <Box
        style={[
          { flexDirection: "row", alignItems: "flex-end" },
          composerUsesViewportSafeBottom ? composerSafeBottomStyle() : { paddingBottom: tokens.space.sm },
        ]}
      >
        <TextInput
          value={draft}
          editable={sessionReady && !busy}
          multiline
          placeholder={sessionReady ? "输入问题…" : "请先创建会话"}
          onChangeText={setDraft}
          style={{
            flex: 1,
            minHeight: tokens.touchTargetMin,
            maxHeight: 120,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            borderRadius: tokens.radius.sm,
            paddingHorizontal: tokens.space.sm,
            paddingVertical: tokens.space.sm,
            fontSize: tokens.fontSize.sm,
            marginRight: tokens.space.sm,
          }}
        />
        <Pressable
          onPress={() => void submit()}
          disabled={!sessionReady || busy || draft.trim() === ""}
          style={{
            minHeight: tokens.touchTargetMin,
            minWidth: 72,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: tokens.colors.primary,
            borderRadius: tokens.radius.sm,
            opacity: !sessionReady || busy || draft.trim() === "" ? 0.45 : 1,
          }}
        >
          <Text style={{ color: tokens.colors.primaryContrast, fontWeight: "700" }}>{busy ? "…" : "发送"}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
