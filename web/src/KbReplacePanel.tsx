import { useCallback, useRef, useState } from "react";
import { ApiRequestError, errorToBannerText, fetchJson } from "./api";

type ReplaceOk = {
  sourceKey: string;
  chunkCount: number;
  replacedAt: string;
};

export function KbReplacePanel(props: { onNotice: (msg: string, kind: "ok" | "err") => void }) {
  const { onNotice } = props;
  const [busy, setBusy] = useState(false);
  const [okLine, setOkLine] = useState<string | null>(null);
  const okTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const token = import.meta.env.VITE_HTTP_ADMIN_TOKEN?.trim();
  const missingToken = token === undefined || token === "";

  const onUpload = useCallback(
    async (file: File | null) => {
      if (file === null) {
        return;
      }
      if (missingToken) {
        onNotice(
          "未设置 VITE_HTTP_ADMIN_TOKEN：请在 web/.env.local 填写（与根目录 HTTP_ADMIN_TOKEN 一致），勿提交该文件。",
          "err",
        );
        return;
      }
      const fd = new FormData();
      fd.append("file", file, file.name);
      setBusy(true);
      if (okTimer.current !== undefined) {
        clearTimeout(okTimer.current);
      }
      setOkLine(null);
      try {
        const out = await fetchJson<ReplaceOk>("/v1/knowledge-base/replace", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const line = `替换成功：chunkCount=${String(out.chunkCount)}，sourceKey=${out.sourceKey}`;
        setOkLine(line);
        onNotice(line, "ok");
        okTimer.current = setTimeout(() => setOkLine(null), 8000);
      } catch (e) {
        let extra = errorToBannerText(e);
        if (e instanceof ApiRequestError) {
          if (e.status === 401) {
            extra = `${extra}（请核对 VITE_HTTP_ADMIN_TOKEN 与 HTTP_ADMIN_TOKEN 是否一致）`;
          } else if (e.status === 413) {
            extra = `${extra}（可调整 KB_UPLOAD_MAX_BYTES）`;
          }
        }
        onNotice(extra, "err");
      } finally {
        setBusy(false);
      }
    },
    [missingToken, onNotice, token],
  );

  return (
    <section style={{ border: "1px solid #ccc", padding: 12, borderRadius: 8 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>替换知识库</h2>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#555" }}>
        仅 PDF；需 Bearer，开发环境用 <code>VITE_HTTP_ADMIN_TOKEN</code>（勿提交）。
      </p>
      {okLine !== null ? (
        <div
          role="status"
          style={{
            marginBottom: 8,
            padding: 8,
            borderRadius: 6,
            background: "#e8ffe8",
            border: "1px solid #8c8",
            fontSize: 13,
          }}
        >
          {okLine}
        </div>
      ) : null}
      <input
        type="file"
        accept="application/pdf"
        data-testid="kb-file-input"
        disabled={busy || missingToken}
        title={
          missingToken
            ? "请先在 web/.env.local 配置 VITE_HTTP_ADMIN_TOKEN"
            : busy
              ? "上传处理中…"
              : "选择 PDF 上传"
        }
        onChange={(ev) => {
          const f = ev.target.files?.[0] ?? null;
          void onUpload(f);
          ev.target.value = "";
        }}
      />
      {busy ? <p style={{ margin: "8px 0 0" }}>上传与入库中…（大文件可能较久）</p> : null}
    </section>
  );
}
