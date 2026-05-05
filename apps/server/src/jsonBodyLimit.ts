/**
 * JSON 路由（`express.json`）体大小上限，与 multipart `KB_UPLOAD_MAX_BYTES` 独立。
 */
export function readHttpJsonBodyMaxBytes(): number {
  const raw = process.env.HTTP_JSON_BODY_MAX_BYTES?.trim();
  if (raw === undefined || raw === "") {
    return 262_144;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 4096 || n > 10 * 1024 * 1024) {
    return 262_144;
  }
  return n;
}
