const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

export function readKbUploadMaxBytes(): number {
  const raw = process.env.KB_UPLOAD_MAX_BYTES?.trim();
  if (raw === undefined || raw === "") {
    return DEFAULT_MAX_BYTES;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`无效 KB_UPLOAD_MAX_BYTES：${raw}`);
  }
  return n;
}
