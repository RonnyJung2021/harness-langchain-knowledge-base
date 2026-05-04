import path from "node:path";
import { createArkChat } from "./ask/arkChat.js";
import { buildDefaultRagSystemPrompt, explainApiError, formatCitationLine } from "./chat/ragFormatting.js";
import { loadKbRagContext } from "./chat/loadKbRagContext.js";
import { runRagChatTurn } from "./chat/ragTurn.js";

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

async function main(): Promise<void> {
  const { cfg, ragCfg, embeddings, vectorStore } = await loadKbRagContext();
  const question = parseQuestionFromArgv();

  try {
    const out = await runRagChatTurn(
      {
        userText: question,
        sessionId: "cli",
        history: [],
      },
      {
        embeddings,
        vectorStore,
        ragConfig: ragCfg,
        createChat: () => createArkChat(cfg),
        buildSystemPrompt: buildDefaultRagSystemPrompt,
      },
    );

    console.log("========== 引用片段摘要 ==========");
    if (out.citations.length === 0) {
      console.log("（无检索结果：知识库可能为空或与问题无关。）");
    } else {
      out.citations.forEach((c) => {
        console.log(formatCitationLine(c));
      });
      if (out.degraded) {
        console.log(
          `\n（提示：没有片段达到相似度阈值 ${ragCfg.scoreMin}，以上为分数最高的前 ${ragCfg.topK} 条；可调低环境变量 ARK_RAG_SCORE_MIN 或改写问题。）`,
        );
      }
    }
    console.log("====================================\n");

    console.log("========== 回答 ==========");
    console.log(out.assistantText);
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
