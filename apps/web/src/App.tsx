import { createWebIndexedDbKbBundleStore } from "@kb-rag/client-offline-core";
import { DesignSystemSmoke } from "@kb-rag/design-system";
import { KbWorkspaceApp } from "@kb-rag/app-shared";
import { useCallback, useRef } from "react";

const webKbBundleStore = createWebIndexedDbKbBundleStore();

export default function App() {
  if (import.meta.env.VITE_DS_SMOKE === "1") {
    return <DesignSystemSmoke colorScheme="light" />;
  }

  const inputRef = useRef<HTMLInputElement>(null);

  const pickPdfFile = useCallback(() => {
    return new Promise<File | null>((resolve) => {
      const el = inputRef.current;
      if (el === null) {
        resolve(null);
        return;
      }
      el.onchange = (): void => {
        const f = el.files?.[0] ?? null;
        el.value = "";
        resolve(f);
      };
      el.click();
    });
  }, []);

  const adminToken = import.meta.env.VITE_HTTP_ADMIN_TOKEN?.trim();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        aria-hidden
      />
      <KbWorkspaceApp
        apiBaseUrl=""
        adminToken={adminToken}
        pickPdfFile={pickPdfFile}
        kbBundleStore={webKbBundleStore}
      />
    </>
  );
}
