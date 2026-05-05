import type { ChatMessage } from "./domain.js";
import type { PostSessionMessageResponseBody } from "./httpShape.js";

/**
 * `kb_store/vectors.json` 根数组中单条记录的 JSON 形状（与磁盘序列化一致）。
 *
 * @see 服务端读写：`packages/api-core/src/store/localVectorStore.ts`
 */
export type SerializedMemoryVector = {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  id?: string;
};

/**
 * `kb_store/manifest.json` 的 v1 清单形状（与磁盘序列化一致）。
 *
 * @see 服务端读写：`packages/api-core/src/store/localVectorStore.ts`
 */
export type KbManifestV1 = {
  version: 1;
  updatedAt: string;
  embeddingModel: string;
  totalChunks: number;
  sources: string[];
  lastIngest?: {
    source: string;
    chunkCount: number;
    durationMs: number;
  };
};

/**
 * 端内（浏览器 / RN）可加载的「知识库快照」：与 `kb_store` 下 `manifest.json` + `vectors.json`
 * 字段名一致，便于同步落盘与反序列化。
 */
export type LocalKbBundle = {
  manifest: KbManifestV1;
  vectors: SerializedMemoryVector[];
};

/**
 * 端内 RAG 单轮输入：当前用户句 + 多轮历史（不含本轮用户句的重复携带规则由调用方约定）。
 */
export type LocalRagTurnInput = {
  userText: string;
  history: ChatMessage[];
};

/**
 * 端内 RAG 单轮输出；**字段与** {@link PostSessionMessageResponseBody} **一致**
 *（即 `POST /v1/sessions/:sessionId/messages` 成功响应体），便于 Web / RN 共用 UI 与类型守卫。
 */
export type LocalRagTurnOutput = PostSessionMessageResponseBody;
