import { gzipSync } from "node:zlib";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";
import type { ChatServerContext } from "./chatServerContext.js";
import { HttpError } from "./httpError.js";
import { readKbUploadMaxBytes } from "./kbUploadLimits.js";
import {
  readManifest,
  readSerializedVectors,
  reloadVectorStoreIntoRagDeps,
  replaceKnowledgeBaseFromUploadedFile,
} from "@kb-rag/api-core";
import { requireAdminBearer } from "./requireAdminBearer.js";

/** 超过该字节数的 JSON 响应可协商 `gzip`（`Content-Encoding: gzip`）。 */
const KB_BUNDLE_GZIP_MIN_BYTES = 32 * 1024;

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
 * `POST /v1/knowledge-base/replace`、`GET /v1/knowledge-base/bundle`（Express 路径采用 `/`）
 */
export function createV1KbReplaceRouter(ctx: ChatServerContext): Router {
  const router = Router();
  const maxBytes = readKbUploadMaxBytes();
  const uploadMw = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
  });

  router.get(
    "/knowledge-base/bundle",
    requireAdminBearer,
    wrapAsync(async (req, res) => {
      const manifest = await readManifest(ctx.repoRoot);
      if (manifest === null) {
        throw new HttpError(404, "KB_MANIFEST_NOT_FOUND", "kb_store 中不存在 manifest.json 或不可读");
      }
      const vectors = await readSerializedVectors(ctx.repoRoot);
      if (vectors.length === 0) {
        throw new HttpError(404, "KB_VECTORS_EMPTY", "kb_store 中无向量数据（vectors 为空），请先 ingest");
      }
      const body = { manifest, vectors };
      const json = `${JSON.stringify(body)}\n`;
      const buf = Buffer.from(json, "utf8");
      const accept = req.headers["accept-encoding"] ?? "";
      const wantGzip =
        typeof accept === "string" &&
        accept.split(",").some((p) => p.trim().toLowerCase().startsWith("gzip")) &&
        buf.length >= KB_BUNDLE_GZIP_MIN_BYTES;
      if (wantGzip) {
        const gz = gzipSync(buf, { level: 6 });
        res.status(200);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        res.end(gz);
        return;
      }
      res.status(200).json(body);
    }),
  );

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
