import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./httpError.js";

/**
 * 校验 `Authorization: Bearer <HTTP_ADMIN_TOKEN>`；未配置或 token 不匹配 → 401。
 */
export function requireAdminBearer(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.HTTP_ADMIN_TOKEN?.trim();
  if (expected === undefined || expected === "") {
    next(new HttpError(401, "UNAUTHORIZED", "服务端未配置 HTTP_ADMIN_TOKEN，拒绝替换知识库"));
    return;
  }
  const raw = req.headers.authorization;
  if (typeof raw !== "string" || raw.trim() === "") {
    next(new HttpError(401, "UNAUTHORIZED", "缺少 Authorization: Bearer"));
    return;
  }
  const m = /^Bearer\s+(\S+)\s*$/i.exec(raw.trim());
  const token = m?.[1];
  if (token === undefined || token !== expected) {
    next(new HttpError(401, "UNAUTHORIZED", "Bearer token 无效"));
    return;
  }
  next();
}
