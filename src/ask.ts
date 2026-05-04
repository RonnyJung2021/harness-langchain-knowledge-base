import path from "node:path";
import type { Document } from "@langchain/core/documents";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { loadArkConfig } from "./config.js";
import { createArkChat } from "./ask/arkChat.js";
import { createArkEmbeddings } from "./embed/arkEmbeddings.js";
import { getRepoRoot } from "./paths/repoRoot.js";
import { retrieveRelevantChunks, type ScoredDoc } from "./ask/retrieve.js";
import { loadRagRetrievalConfig } from "./ask/ragEnv.js";
import {
  assertEmbeddingModelCompatible,
  memoryStoreFromSerialized,
  readManifest,
  readSerializedVectors,
} from "./store/localVectorStore.js";

function parseQuestionFromArgv(): string {
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  const scriptIdx = raw.findIndex(
    (a) => a.endsWith(`${path.sep}ask.ts`) || a.endsWith("/ask.ts"),
  );
  const rest = scriptIdx >= 0 ? raw.slice(scriptIdx + 1) : raw;
  const joined = rest.join(" ").trim();
  if (!joined) {
    throw new Error('请传入问题，例如：pnpm ask -- "这份资料的核心结论是什么？"');
  }
  return joined;
}

function metaString(meta: unknown): string {
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

function formatCitationLine(index: number, doc: Document, score: number): string {
  const source = String(doc.metadata?.source ?? "未知来源");
  const chunkRaw = doc.metadata?.chunkIndex;
  const chunk =
    typeof chunkRaw === "number"
      ? chunkRaw
      : typeof chunkRaw === "string"
        ? chunkRaw
        : index;
  const preview = doc.pageContent.replace(/\s+/g, " ").slice(0, 80);
  return `[${index}] 文件：${source}，块序号：${chunk}，相似度：${score.toFixed(4)}\n    前80字：${preview}`;
}

function buildContextBlock(hits: ScoredDoc[]): string {
  return hits
    .map((h, i) => {
      const header = `### 片段 ${i + 1}（metadata: ${metaString(h.doc.metadata)}）\n`;
      return `${header}${h.doc.pageContent}`;
    })
    .join("\n\n---\n\n");
}

function explainApiError(err: unknown): string {
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

async function main(): Promise<void> {
  const repoRoot = getRepoRoot();
  const cfg = loadArkConfig();
  const ragCfg = loadRagRetrievalConfig();

  const rows = await readSerializedVectors(repoRoot);
  if (rows.length === 0) {
    throw new Error(
      "未找到向量数据：请先执行 `pnpm ingest -- pdfs/某文件.pdf` 写入 kb_store 后再提问。",
    );
  }

  const manifest = await readManifest(repoRoot);
  assertEmbeddingModelCompatible(manifest, cfg.embedModel);

  const embeddings = createArkEmbeddings(cfg);
  const store = await memoryStoreFromSerialized(embeddings, rows);
  const question = parseQuestionFromArgv();

  const { hits, degraded } = await retrieveRelevantChunks(
    store,
    question,
    ragCfg,
  );

  console.log("========== 引用片段摘要 ==========");
  if (hits.length === 0) {
    console.log("（无检索结果：知识库可能为空或与问题无关。）");
  } else {
    hits.forEach((h, i) => {
      console.log(formatCitationLine(i + 1, h.doc, h.score));
    });
    if (degraded) {
      console.log(
        `\n（提示：没有片段达到相似度阈值 ${ragCfg.scoreMin}，以上为分数最高的前 ${ragCfg.topK} 条；可调低环境变量 ARK_RAG_SCORE_MIN 或改写问题。）`,
      );
    }
  }
  console.log("====================================\n");

  const context = buildContextBlock(hits);
  const system = [
    "你是中文助手，请只根据用户提供的【参考资料】回答问题；",
    "若资料不足以回答，请直接说明，不要编造。",
    "回答尽量简洁、有条理。",
    "",
    "【参考资料】",
    context || "（当前无可用片段）",
  ].join("\n");

  const chat = createArkChat(cfg);
  try {
    const res = await chat.invoke([
      new SystemMessage(system),
      new HumanMessage(question),
    ]);
    const text =
      typeof res.content === "string"
        ? res.content
        : Array.isArray(res.content)
          ? res.content
              .map((b) => ("text" in b ? String((b as { text?: string }).text) : ""))
              .join("")
          : String(res.content);

    console.log("========== 回答 ==========");
    console.log(text.trim());
    console.log("==========================");
  } catch (e) {
    const hint = explainApiError(e);
    console.error(hint);
    throw e;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
