import { DesignSystemSmoke } from "@kb-rag/design-system";
import { KbWorkspaceApp } from "@kb-rag/app-shared";
import type { PdfFileLike } from "@kb-rag/app-shared";
import * as DocumentPicker from "expo-document-picker";
import { StatusBar } from "expo-status-bar";
import { createRnKbBundleStore } from "./src/storage/rnKbBundleStore";

const rnKbBundleStore = createRnKbBundleStore();

/**
 * Native 入口：`EXPO_PUBLIC_API_BASE_URL` 由 Expo 注入；Web 同源场景在 apps/web 使用 `apiBaseUrl=""`。
 * 密钥类仅服务端保管，勿使用 EXPO_PUBLIC_*。
 */
export default function App() {
  if (process.env.EXPO_PUBLIC_DS_SMOKE === "1") {
    return (
      <>
        <StatusBar style="auto" />
        <DesignSystemSmoke colorScheme="light" />
      </>
    );
  }

  const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  const token = process.env.EXPO_PUBLIC_HTTP_ADMIN_TOKEN?.trim();

  const pickPdfFile = async (): Promise<PdfFileLike | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) {
      return null;
    }
    const asset = result.assets[0];
    if (asset === undefined) {
      return null;
    }
    return {
      uri: asset.uri,
      name: asset.name ?? "upload.pdf",
      mimeType: asset.mimeType ?? "application/pdf",
    };
  };

  return (
    <>
      <StatusBar style="auto" />
      <KbWorkspaceApp
        apiBaseUrl={base}
        adminToken={token}
        pickPdfFile={pickPdfFile}
        kbBundleStore={rnKbBundleStore}
      />
    </>
  );
}
