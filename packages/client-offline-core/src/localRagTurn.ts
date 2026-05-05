import type { ChatMessage, LocalKbBundle, LocalRagTurnInput, LocalRagTurnOutput } from "@kb-rag/shared";
import {
  buildContextBlock,
  buildDefaultRagSystemPrompt,
  citationSummaryFromScoredDoc,
  truncateReferencesContextBlock,
} from "./ragFormat.js";
import { localRetrieveRelevantChunks, type RagRetrievalConfigLite } from "./localRetrieve.js";
import { getQueryEmbedding } from "./stubEmbed.js";
import { OFFLINE_STUB_REPLY } from "./offlineStubReply.js";

/** 与 `packages/api-core/src/chat/chatContextEnv.ts` 默认值一致（无 `process.env`，由调用方用 opts 覆盖）。 */
export type LocalChatContextLimits = {
  maxHistoryMessages: number;
  ragContextMaxChars: number;
};

const DEFAULT_MAX_HISTORY_MESSAGES = 20;
const DEFAULT_RAG_CONTEXT_MAX_CHARS = 12_000;

const DEFAULT_RAG_CONFIG: RagRetrievalConfigLite = { topK: 4, scoreMin: 0.35 };

function defaultContextLimits(): LocalChatContextLimits {
  return {
    maxHistoryMessages: DEFAULT_MAX_HISTORY_MESSAGES,
    ragContextMaxChars: DEFAULT_RAG_CONTEXT_MAX_CHARS,
  };
}

/**
 * 与 `packages/api-core/src/chat/ragTurn.ts` 中 {@link trimHistoryForRagModel} 逻辑一致（纯复制）。
 */
export function trimHistoryForRagModel(history: ChatMessage[], maxCount: number): ChatMessage[] {
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

/** 与 `assembleRagInvokeMessages` + `chatMessageToBaseMessage` 语义一致，使用 `role`/`content` 数组（无 LangChain Message 类）。 */
export type LocalRagChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function assembleLocalRagMessages(
  systemText: string,
  history: ChatMessage[],
  userText: string,
  maxHistoryMessages: number,
): LocalRagChatMessage[] {
  const historyForModel = trimHistoryForRagModel(history, maxHistoryMessages);
  const out: LocalRagChatMessage[] = [{ role: "system", content: systemText }];
  for (const m of historyForModel) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content });
    } else {
      out.push({ role: "user", content: `[system]\n${m.content}` });
    }
  }
  out.push({ role: "user", content: userText });
  return out;
}

export type LocalRagTurnOpts = {
  ragConfig?: RagRetrievalConfigLite;
  contextLimits?: Partial<LocalChatContextLimits>;
};

/** V1：等价于 `OfflineStubInferenceProvider.chat`（忽略 messages 内容）。 */
function localStubInferenceChat(_messages: LocalRagChatMessage[]): string {
  return OFFLINE_STUB_REPLY;
}

/**
 * 端内整轮 RAG（检索 + system 拼装 + V1 占位回答），输出与 `POST /v1/sessions/:id/messages` 成功体字段对齐。
 *
 * 检索与上下文裁剪逻辑对齐 `packages/api-core/src/chat/ragTurn.ts` 的 `prepareRagTurnMessages`；
 * 生成对齐 `packages/api-core/src/providers/offline/stubInference.ts` 固定占位句。
 */
export async function runLocalRagTurn(
  input: LocalRagTurnInput,
  bundle: LocalKbBundle,
  opts?: LocalRagTurnOpts,
): Promise<LocalRagTurnOutput> {
  const vectors = bundle.vectors;
  if (vectors.length === 0) {
    throw new Error("runLocalRagTurn：bundle.vectors 为空，无法确定嵌入维度或检索");
  }
  const dim = vectors[0]!.embedding.length;
  if (!Number.isFinite(dim) || dim < 1) {
    throw new Error("runLocalRagTurn：首条向量缺少有效 embedding.length");
  }
  if (!vectors.every((r) => r.embedding.length === dim)) {
    throw new Error("runLocalRagTurn：向量维度不一致");
  }

  const ragConfig: RagRetrievalConfigLite = { ...DEFAULT_RAG_CONFIG, ...opts?.ragConfig };
  const limits: LocalChatContextLimits = {
    ...defaultContextLimits(),
    ...opts?.contextLimits,
  };

  const qEmb = getQueryEmbedding(input.userText, dim);
  const { hits, degraded } = localRetrieveRelevantChunks(vectors, qEmb, ragConfig);

  const citations = hits.map((h, i) => citationSummaryFromScoredDoc(i + 1, h));
  const referencesRaw = buildContextBlock(hits);
  const referencesBlock = truncateReferencesContextBlock(referencesRaw, limits.ragContextMaxChars);
  const systemText = buildDefaultRagSystemPrompt(referencesBlock);

  const messages = assembleLocalRagMessages(
    systemText,
    input.history,
    input.userText,
    limits.maxHistoryMessages,
  );
  const answer = localStubInferenceChat(messages).trim();

  return {
    answer,
    citations,
    ...(degraded ? { degraded: true } : {}),
  };
}
