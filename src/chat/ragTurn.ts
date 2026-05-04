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
import type { ChatMessage, RagTurnInput, RagTurnOutput } from "./sessionTypes.js";

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

export async function runRagChatTurn(
  input: RagTurnInput,
  deps: RagTurnDeps,
): Promise<RagTurnOutput> {
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

  const res = await deps.createChat().invoke(messages);

  const assistantText = extractAssistantTextFromInvokeContent(res.content).trim();

  return {
    assistantText,
    citations,
    degraded: degraded || undefined,
  };
}
