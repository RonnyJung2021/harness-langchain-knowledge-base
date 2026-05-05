import type { CitationSummary } from "@kb-rag/shared";

/**
 * 与 `MemoryVectorStore` / `retrieveRelevantChunks` 命中项同构的最小 `doc` 形状，
 * 供 {@link buildContextBlock}、{@link citationSummaryFromScoredDoc} 使用（无 LangChain `Document` 依赖）。
 *
 * @see `packages/api-core/src/ask/retrieve.ts` 的 `ScoredDoc`
 */
export type RagScoredDoc = {
  doc: {
    pageContent: string;
    metadata: Record<string, unknown>;
  };
  score: number;
};

/** 与 `packages/api-core/src/chat/ragFormatting.ts` 中 `metaString` 一致。 */
export function metaString(meta: unknown): string {
  if (meta === undefined || meta === null) {
    return "";
  }
  if (typeof meta === "string") {
    return meta;
  }
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

/** 与 `packages/api-core/src/chat/ragFormatting.ts` 中 `citationSummaryFromScoredDoc` 一致。 */
export function citationSummaryFromScoredDoc(index: number, { doc, score }: RagScoredDoc): CitationSummary {
  const sourceFile = String(doc.metadata?.source ?? "未知来源");
  const chunkRaw = doc.metadata?.chunkIndex;
  const chunkIndex =
    typeof chunkRaw === "number" ? chunkRaw : typeof chunkRaw === "string" ? chunkRaw : index;
  const preview80 = doc.pageContent.replace(/\s+/g, " ").slice(0, 80);
  return { index, sourceFile, chunkIndex, score, preview80 };
}

/** 与 `packages/api-core/src/chat/ragFormatting.ts` 中 `formatCitationLine` 一致。 */
export function formatCitationLine(c: CitationSummary): string {
  return `[${c.index}] 文件：${c.sourceFile}，块序号：${c.chunkIndex}，相似度：${c.score.toFixed(4)}\n    前80字：${c.preview80}`;
}

/** 与 `packages/api-core/src/chat/ragFormatting.ts` 中 `REFERENCES_CONTEXT_FRAGMENT_SEPARATOR` 一致。 */
export const REFERENCES_CONTEXT_FRAGMENT_SEPARATOR = "\n\n---\n\n";

/** 与 `packages/api-core/src/chat/ragFormatting.ts` 中 `buildContextBlock` 一致。 */
export function buildContextBlock(hits: RagScoredDoc[]): string {
  return hits
    .map((h, i) => {
      const header = `### 片段 ${i + 1}（metadata: ${metaString(h.doc.metadata)}）\n`;
      return `${header}${h.doc.pageContent}`;
    })
    .join(REFERENCES_CONTEXT_FRAGMENT_SEPARATOR);
}

const REFERENCES_TRUNCATION_MARKER = "\n\n「后略」";

/**
 * 与 `packages/api-core/src/chat/ragFormatting.ts` 中 `truncateReferencesContextBlock` 一致；
 * `maxChars` 由调用方传入（线上默认来自 `loadChatContextLimits().ragContextMaxChars` / `ARK_RAG_CONTEXT_MAX_CHARS`）。
 */
export function truncateReferencesContextBlock(body: string, maxChars: number): string {
  if (body.length <= maxChars) {
    return body;
  }

  const marker = REFERENCES_TRUNCATION_MARKER;
  const markerLen = marker.length;
  const budget = maxChars - markerLen;
  if (budget <= 0) {
    return body.slice(0, Math.max(0, maxChars));
  }

  const parts = body.split(REFERENCES_CONTEXT_FRAGMENT_SEPARATOR);
  let acc = "";

  for (const part of parts) {
    const sep = acc.length > 0 ? REFERENCES_CONTEXT_FRAGMENT_SEPARATOR : "";
    const candidate = acc + sep + part;
    if (candidate.length <= budget) {
      acc = candidate;
      continue;
    }
    break;
  }

  if (acc.length === 0 && parts[0] !== undefined && parts[0].length > 0) {
    acc = parts[0].slice(0, budget);
  }

  return acc + marker;
}

/**
 * 与 `packages/api-core/src/chat/ragFormatting.ts` 中 `buildDefaultRagSystemPrompt` 全文一致
 *（`packages/api-core/src/ragDeps.ts` 默认注入 `buildSystemPrompt`）。
 *
 * 另提供别名 {@link buildSystemPrompt}，与 `ragTurn` 依赖字段名对齐。
 */
export function buildDefaultRagSystemPrompt(referencesMarkdown: string): string {
  return [
    "你是中文助手，请只根据用户提供的【参考资料】回答问题；",
    "若资料不足以回答，请直接说明，不要编造。",
    "回答尽量简洁、有条理。",
    "",
    "【参考资料】",
    referencesMarkdown || "（当前无可用片段）",
  ].join("\n");
}

/** 与 {@link buildDefaultRagSystemPrompt} 相同（命名对齐 `RagTurnDeps.buildSystemPrompt`）。 */
export const buildSystemPrompt = buildDefaultRagSystemPrompt;
