import type { ChatMessage, CitationSummary } from "./sessionTypes.js";

/** POST /v1/sessions/:sessionId/messages */
export type PostSessionMessageRequestBody = {
  text: string;
};

/** POST /v1/sessions/:sessionId/messages → 200 */
export type PostSessionMessageResponseBody = {
  answer: string;
  citations: CitationSummary[];
  degraded?: boolean;
};

/** GET /v1/sessions/:sessionId → 200 */
export type GetSessionResponseBody = {
  id: string;
  messages: ChatMessage[];
};

/** POST /v1/sessions → 201 */
export type PostSessionResponseBody = {
  sessionId: string;
};

/** POST /v1/knowledge-base/replace → 200 */
export type PostKbReplaceResponseBody = {
  sourceKey: string;
  chunkCount: number;
  replacedAt: string;
};
