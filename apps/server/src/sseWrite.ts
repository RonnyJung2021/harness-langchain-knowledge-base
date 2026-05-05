import type { Response } from "express";

/**
 * 写入一条 SSE 消息帧（`event` + 单行 `data:`，payload 经 JSON 序列化，避免 data 内换行破坏帧边界）。
 */
export function writeSseEvent(res: Response, event: string, payload: unknown): void {
  const line = JSON.stringify(payload);
  res.write(`event: ${event}\ndata: ${line}\n\n`);
}

export function initSseResponse(res: Response): void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as { flushHeaders: () => void }).flushHeaders();
  }
}
