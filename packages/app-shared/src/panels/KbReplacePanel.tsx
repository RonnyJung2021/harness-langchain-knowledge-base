import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Box, Pressable, Text } from "@kb-rag/design-system";
import { useTheme } from "@kb-rag/design-system";
import { ApiRequestError, errorToBannerText } from "../api/httpApi.js";
import { postKbReplaceMultipart, type PdfFileLike } from "../hooks/useKbReplace.js";

export type KbReplacePanelProps = {
  apiBaseUrl: string;
  adminToken?: string;
  onNotice: (msg: string, kind: "ok" | "err") => void;
  /** Web：`input[type=file]`；Native：`expo-document-picker` 等 */
  pickPdfFile: () => Promise<PdfFileLike | null>;
};

export function KbReplacePanel(props: KbReplacePanelProps) {
  const { tokens } = useTheme();
  const { apiBaseUrl, adminToken, onNotice, pickPdfFile } = props;
  const [busy, setBusy] = useState(false);
  const [okLine, setOkLine] = useState<string | null>(null);
  const okTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const token = adminToken?.trim();
  const missingToken = token === undefined || token === "";

  const onPickAndUpload = useCallback(async () => {
    if (missingToken) {
      onNotice("未配置 Admin Token：Web 使用环境变量注入；Native 使用 EXPO_PUBLIC_HTTP_ADMIN_TOKEN。", "err");
      return;
    }
    const file = await pickPdfFile();
    if (file === null) {
      return;
    }
    setBusy(true);
    if (okTimer.current !== undefined) {
      clearTimeout(okTimer.current);
    }
    setOkLine(null);
    try {
      const out = await postKbReplaceMultipart({
        apiBaseUrl,
        adminToken: token,
        pdf: file,
      });
      const line = `替换成功：chunkCount=${String(out.chunkCount)}，sourceKey=${out.sourceKey}`;
      setOkLine(line);
      onNotice(line, "ok");
      okTimer.current = setTimeout(() => setOkLine(null), 8000);
    } catch (e) {
      let extra = errorToBannerText(e);
      if (e instanceof ApiRequestError) {
        if (e.code !== undefined) {
          extra = `[${e.code}] ${extra}`;
        }
        if (e.status === 401) {
          extra = `${extra}（请核对 Admin Token 与 HTTP_ADMIN_TOKEN 是否一致）`;
        } else if (e.status === 413) {
          extra = `${extra}（可调整 KB_UPLOAD_MAX_BYTES）`;
        }
      }
      onNotice(extra, "err");
    } finally {
      setBusy(false);
    }
  }, [apiBaseUrl, missingToken, onNotice, pickPdfFile, token]);

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
        替换知识库
      </Text>
      <Text style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted, marginBottom: tokens.space.md }}>
        仅 PDF；需 Bearer（勿将长期密钥提交到仓库）。
      </Text>
      {okLine !== null ? (
        <Box
          style={{
            marginBottom: tokens.space.md,
            padding: tokens.space.sm,
            borderRadius: tokens.radius.sm,
            backgroundColor: tokens.colors.successBg,
            borderWidth: 1,
            borderColor: tokens.colors.successBorder,
          }}
        >
          <Text style={{ fontSize: tokens.fontSize.sm }}>{okLine}</Text>
        </Box>
      ) : null}
      <Pressable
        onPress={() => void onPickAndUpload()}
        disabled={busy || missingToken}
        style={{
          minHeight: tokens.touchTargetMin,
          paddingHorizontal: tokens.space.lg,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: missingToken ? tokens.colors.border : tokens.colors.primary,
          borderRadius: tokens.radius.sm,
          opacity: busy ? 0.65 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color={tokens.colors.primaryContrast} />
        ) : (
          <Text style={{ color: tokens.colors.primaryContrast, fontWeight: "600" }}>
            {missingToken ? "需先配置 Token" : "选择 PDF 上传"}
          </Text>
        )}
      </Pressable>
    </Box>
  );
}
