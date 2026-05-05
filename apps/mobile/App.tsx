import { KbWorkspaceApp } from "@kb-rag/app-shared";
import type { PdfFileLike } from "@kb-rag/app-shared";
import * as DocumentPicker from "expo-document-picker";
import { StatusBar } from "expo-status-bar";

export default function App() {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  const token = process.env.EXPO_PUBLIC_HTTP_ADMIN_TOKEN?.trim();

  const pickPdfFile = async (): Promise<PdfFileLike | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
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
      <KbWorkspaceApp apiBaseUrl={base} adminToken={token} pickPdfFile={pickPdfFile} />
    </>
  );
}
