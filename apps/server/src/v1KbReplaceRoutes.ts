import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";
import type { ChatServerContext } from "./chatServerContext.js";
import { HttpError } from "./httpError.js";
import { readKbUploadMaxBytes } from "./kbUploadLimits.js";
import { reloadVectorStoreIntoRagDeps, replaceKnowledgeBaseFromUploadedFile } from "@kb-rag/api-core";
import { requireAdminBearer } from "./requireAdminBearer.js";

function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

function isPdfMagic(buf: Buffer): boolean {
  if (buf.length < 5) {
    return false;
  }
  return buf.subarray(0, 5).toString("binary") === "%PDF-";
}

function assertPdfUpload(file: Express.Multer.File): void {
  const okMime = file.mimetype === "application/pdf";
  const okMagic = isPdfMagic(file.buffer);
  if (!okMime && !okMagic) {
    throw new HttpError(
      415,
      "INVALID_MIME",
      "仅接受 PDF：Content-Type 须为 application/pdf，或文件头为 %PDF-",
    );
  }
}

async function parseMultipartSingle(
  req: Request,
  res: Response,
  upload: ReturnType<typeof multer>,
  maxBytes: number,
): Promise<Express.Multer.File> {
  await new Promise<void>((resolve, reject) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err !== undefined && err !== null) {
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
          reject(
            new HttpError(
              413,
              "PAYLOAD_TOO_LARGE",
              `上传超过 KB_UPLOAD_MAX_BYTES（${String(maxBytes)} 字节）`,
            ),
          );
          return;
        }
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      resolve();
    });
  });
  const f = req.file;
  if (f === undefined) {
    throw new HttpError(400, "NO_FILE", "缺少 multipart 字段 file");
  }
  return f;
}

/**
 * `POST /v1/knowledge-base/replace`（与指南中 `knowledge-base:replace` 同义；Express 路径采用 `/`）
 */
export function createV1KbReplaceRouter(ctx: ChatServerContext): Router {
  const router = Router();
  const maxBytes = readKbUploadMaxBytes();
  const uploadMw = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
  });

  router.post(
    "/knowledge-base/replace",
    requireAdminBearer,
    wrapAsync(async (req, res) => {
      const file = await parseMultipartSingle(req, res, uploadMw, maxBytes);
      assertPdfUpload(file);

      const replacedAt = new Date().toISOString();

      const body = await ctx.enqueueKbReplace(async () => {
        const ingestOut = await replaceKnowledgeBaseFromUploadedFile({
          uploadBytes: file.buffer,
        });

        const oldVs = ctx.ragTurnDeps.vectorStore;
        try {
          await reloadVectorStoreIntoRagDeps(ctx.repoRoot, ctx.arkConfig, ctx.ragTurnDeps, {
            skipEmbeddingModelIdCheck: ctx.runtimeMode === "offline",
          });
        } catch (e) {
          ctx.ragTurnDeps.vectorStore = oldVs;
          req.log?.error({ err: e }, "VECTOR_RELOAD_FAILED");
          throw new HttpError(
            500,
            "VECTOR_RELOAD_FAILED",
            "向量热加载失败，已回滚进程内索引；磁盘 kb_store 可能已更新，请检查日志后重启服务",
          );
        }

        return {
          sourceKey: ingestOut.sourceKey,
          chunkCount: ingestOut.chunkCount,
          replacedAt,
        };
      });

      res.status(200).json(body);
    }),
  );

  return router;
}
