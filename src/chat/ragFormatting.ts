import type { Document } from "@langchain/core/documents";
import type { ScoredDoc } from "../ask/retrieve.js";
import type { CitationSummary } from "./sessionTypes.js";

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

export function citationSummaryFromScoredDoc(
  index: number,
  { doc, score }: ScoredDoc,
): CitationSummary {
  const sourceFile = String(doc.metadata?.source ?? "未知来源");
  const chunkRaw = doc.metadata?.chunkIndex;
  const chunkIndex =
    typeof chunkRaw === "number"
      ? chunkRaw
      : typeof chunkRaw === "string"
        ? chunkRaw
        : index;
  const preview80 = doc.pageContent.replace(/\s+/g, " ").slice(0, 80);
  return { index, sourceFile, chunkIndex, score, preview80 };
}

/** 与历史 ask CLI 单行引用格式一致，供终端打印。 */
export function formatCitationLine(c: CitationSummary): string {
  return `[${c.index}] 文件：${c.sourceFile}，块序号：${c.chunkIndex}，相似度：${c.score.toFixed(4)}\n    前80字：${c.preview80}`;
}

/** 与 {@link buildContextBlock} 拼接逻辑一致，供按片段截断时使用。 */
export const REFERENCES_CONTEXT_FRAGMENT_SEPARATOR = "\n\n---\n\n";

export function buildContextBlock(hits: ScoredDoc[]): string {
  return hits
    .map((h, i) => {
      const header = `### 片段 ${i + 1}（metadata: ${metaString(h.doc.metadata)}）\n`;
      return `${header}${h.doc.pageContent}`;
    })
    .join(REFERENCES_CONTEXT_FRAGMENT_SEPARATOR);
}

const REFERENCES_TRUNCATION_MARKER = "\n\n「后略」";

/**
 * 对【参考资料】拼接块按**片段顺序**保留，总长度不超过 `maxChars`（含结尾「后略」标记）。
 * 单片段超长时对该片段硬截断至预算内并仍附「后略」。
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

export function explainApiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (msg.includes("429") || lower.includes("too many requests")) {
    return "（疑似限流 429：请稍后再试、降低并发，或在方舟控制台查看配额。）";
  }
  if (msg.includes("401") || msg.includes("403")) {
    return "（鉴权失败：请检查 ARK_API_KEY 是否有效、是否绑定正确接入点。）";
  }
  return "";
}

/** 单轮 ask 默认 system：只依据【参考资料】作答，不足则声明无法回答。 */
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

type InvokeContent = unknown;

/** 从 ChatOpenAI.invoke 返回的 AIMessage 抽取纯文本。 */
export function extractAssistantTextFromInvokeContent(content: InvokeContent): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((b) => ("text" in b ? String((b as { text?: string }).text) : ""))
      .join("");
  }
  return String(content);
}
