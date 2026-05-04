import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import type { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import type { ChatOpenAI } from "@langchain/openai";
import type { RagRetrievalConfig } from "../ask/ragEnv.js";
import { retrieveRelevantChunks } from "../ask/retrieve.js";
import type { ChatContextLimits } from "./chatContextEnv.js";
import { loadChatContextLimits } from "./chatContextEnv.js";
import {
  buildContextBlock,
  citationSummaryFromScoredDoc,
  extractAssistantTextFromInvokeContent,
  truncateReferencesContextBlock,
} from "./ragFormatting.js";
import type { ChatMessage, CitationSummary, RagTurnInput, RagTurnOutput } from "./sessionTypes.js";

export type RagTurnDeps = {
  embeddings: EmbeddingsInterface;
  vectorStore: MemoryVectorStore;
  ragConfig: RagRetrievalConfig;
  createChat: () => ChatOpenAI;
  /** 将检索得到的正文块格式化为 system 提示词（须包含「只根据参考资料回答」等策略）。 */
  buildSystemPrompt: (referencesMarkdown: string) => string;
  /** 覆盖环境变量中的上下文裁剪默认值（单测或临时调参）。 */
  contextLimits?: Partial<ChatContextLimits>;
};

/** 检索与 system 拼装完成后、调用模型前的可复用状态（invoke / stream 共用）。 */
type PreparedRagTurn = {
  messages: BaseMessage[];
  citations: CitationSummary[];
  degraded: boolean;
};

/**
 * 仅保留 `user` / `assistant`，按 `createdAt` 升序排序后取尾部 `maxCount` 条。
 * 不含本轮用户输入；`system` 角色不计入条数且不进入模型历史。
 */
export function trimHistoryForRagModel(
  history: ChatMessage[],
  maxCount: number,
): ChatMessage[] {
  const conv = history.filter((m) => m.role === "user" || m.role === "assistant");
  const sorted = [...conv].sort((a, b) => {
    const t = a.createdAt.localeCompare(b.createdAt);
    if (t !== 0) {
      return t;
    }
    return a.id.localeCompare(b.id);
  });
  if (sorted.length <= maxCount) {
    return sorted;
  }
  return sorted.slice(-maxCount);
}

/**
 * 将历史中的 `system` 映射为 HumanMessage，避免与 RAG 顶层 SystemMessage 在部分模型上冲突。
 */
function chatMessageToBaseMessage(m: ChatMessage): BaseMessage {
  if (m.role === "user") {
    return new HumanMessage(m.content);
  }
  if (m.role === "assistant") {
    return new AIMessage(m.content);
  }
  return new HumanMessage(`[system]\n${m.content}`);
}

/**
 * 单条 SystemMessage（含参考资料策略）+ 裁剪后的多轮历史 + 当前用户句。
 */
export function assembleRagInvokeMessages(
  systemText: string,
  history: ChatMessage[],
  userText: string,
): BaseMessage[] {
  return [
    new SystemMessage(systemText),
    ...history.map(chatMessageToBaseMessage),
    new HumanMessage(userText),
  ];
}

async function prepareRagTurnMessages(
  input: RagTurnInput,
  deps: RagTurnDeps,
): Promise<PreparedRagTurn> {
  const limits: ChatContextLimits = {
    ...loadChatContextLimits(),
    ...deps.contextLimits,
  };

  const { hits, degraded } = await retrieveRelevantChunks(
    deps.vectorStore,
    input.userText,
    deps.ragConfig,
  );

  const citations = hits.map((h, i) => citationSummaryFromScoredDoc(i + 1, h));
  const referencesRaw = buildContextBlock(hits);
  const referencesBlock = truncateReferencesContextBlock(
    referencesRaw,
    limits.ragContextMaxChars,
  );
  const systemText = deps.buildSystemPrompt(referencesBlock);

  const historyForModel = trimHistoryForRagModel(input.history, limits.maxHistoryMessages);
  const messages = assembleRagInvokeMessages(systemText, historyForModel, input.userText);

  return {
    messages,
    citations,
    degraded: degraded === true,
  };
}

export async function runRagChatTurn(
  input: RagTurnInput,
  deps: RagTurnDeps,
): Promise<RagTurnOutput> {
  const { messages, citations, degraded } = await prepareRagTurnMessages(input, deps);

  const res = await deps.createChat().invoke(messages);

  const assistantText = extractAssistantTextFromInvokeContent(res.content).trim();

  return {
    assistantText,
    citations,
    degraded: degraded || undefined,
  };
}

/**
 * 与 {@link runRagChatTurn} 相同的检索与 system 策略；模型侧使用 LangChain `stream`，
 * 对每个增量文本块调用 `onTokenDelta`（通常为 UTF-16 子串级增量，依上游 SDK 而定）。
 */
export async function runRagChatTurnStream(
  input: RagTurnInput,
  deps: RagTurnDeps,
  onTokenDelta: (delta: string) => void,
): Promise<RagTurnOutput> {
  const { messages, citations, degraded } = await prepareRagTurnMessages(input, deps);
  const chat = deps.createChat();
  let acc = "";
  const stream = await chat.stream(messages);
  for await (const chunk of stream) {
    const piece = extractAssistantTextFromInvokeContent(chunk.content);
    if (piece.length > 0) {
      acc += piece;
      onTokenDelta(piece);
    }
  }
  const assistantText = acc.trim();
  return {
    assistantText,
    citations,
    degraded: degraded || undefined,
  };
}
