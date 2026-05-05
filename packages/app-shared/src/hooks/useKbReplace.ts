import type { PostKbReplaceResponseBody } from "@kb-rag/shared";
import { fetchJson } from "../api/httpApi.js";

export type PdfFileLike =
  | File
  | {
      uri: string;
      name: string;
      mimeType?: string;
    };

function appendPdfToFormData(fd: FormData, picked: PdfFileLike): void {
  if (typeof File !== "undefined" && picked instanceof File) {
    fd.append("file", picked, picked.name);
    return;
  }
  const p = picked as { uri: string; name: string; mimeType?: string };
  fd.append("file", {
    uri: p.uri,
    name: p.name,
    type: p.mimeType ?? "application/pdf",
  } as unknown as Blob);
}

export async function postKbReplaceMultipart(args: {
  apiBaseUrl: string;
  adminToken: string;
  pdf: PdfFileLike;
}): Promise<PostKbReplaceResponseBody> {
  const fd = new FormData();
  appendPdfToFormData(fd, args.pdf);
  return fetchJson<PostKbReplaceResponseBody>(args.apiBaseUrl, "/v1/knowledge-base/replace", {
    method: "POST",
    headers: { Authorization: `Bearer ${args.adminToken}` },
    body: fd,
  });
}
