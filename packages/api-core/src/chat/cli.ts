import { randomUUID } from "node:crypto";
import * as readline from "node:readline";
import process from "node:process";
import { parseRuntimeMode } from "@kb-rag/shared";
import { createRagDeps } from "../ragDeps.js";
import { explainApiError, formatCitationLine } from "./ragFormatting.js";
import { loadKbRagContext } from "./loadKbRagContext.js";
import { runRagChatTurn, type RagTurnDeps } from "./ragTurn.js";
import { isSessionPersistEnabled } from "./sessionPersistence.js";
import { createInMemorySessionStore } from "./sessionStore.js";
import type { ChatMessage } from "@kb-rag/shared";

function parseResumeSessionId(argv: string[]): string | undefined {
  const idx = argv.indexOf("--resume");
  if (idx >= 0 && argv[idx + 1] !== undefined && argv[idx + 1] !== "") {
    return argv[idx + 1];
  }
  return undefined;
}

function readQuestionLine(rl: readline.Interface, prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const onClose = (): void => {
      finish(null);
    };
    const finish = (value: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      rl.off("close", onClose);
      resolve(value);
    };
    rl.once("close", onClose);
    rl.question(prompt, (answer) => finish(answer));
  });
}

function printTurnOutput(
  out: Awaited<ReturnType<typeof runRagChatTurn>>,
  ragCfg: { scoreMin: number; topK: number },
): void {
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
  console.log("==========================\n");
}

async function main(): Promise<void> {
  const mode = parseRuntimeMode(process.env.RUNTIME_MODE);
  const loaded = await loadKbRagContext(mode);
  const ragCfg = loaded.ragCfg;
  const deps: RagTurnDeps = createRagDeps({ mode, loaded });

  const sessionStore = createInMemorySessionStore();
  const resumeId = parseResumeSessionId(process.argv);
  let sessionId: string;
  if (resumeId !== undefined) {
    sessionStore.resumeSession(resumeId);
    sessionId = resumeId;
  } else {
    sessionId = sessionStore.createSession();
  }

  const persistOn = isSessionPersistEnabled();
  console.log(
    [
      "多轮 RAG 对话已启动。",
      `当前会话 id：${sessionId}`,
      persistOn
        ? "已开启 ARK_SESSION_PERSIST=1：每条用户/助手消息追加后会写入 sessions/ 目录。"
        : "未开启会话落盘（默认）；仅内存保留，退出即失。设置 ARK_SESSION_PERSIST=1 可写盘恢复。",
      resumeId !== undefined
        ? `已从快照恢复，当前内存中消息条数：${sessionStore.get(sessionId)?.length ?? 0}`
        : "",
      "输入问题后回车发送；空行将被忽略。",
      "输入 exit 或 quit 退出；也可使用 Ctrl+D 结束输入并退出。",
      "恢复历史会话：pnpm chat -- --resume <sessionId>（sessionId 须为 UUID，对应 sessions/<id>.json）。",
      "",
    ]
      .filter((s) => s !== "")
      .join("\n"),
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  try {
    while (true) {
      const line = await readQuestionLine(rl, "> ");
      if (line === null) {
        console.log("\n（输入已结束，再见。）");
        break;
      }

      const trimmed = line.trim();
      if (trimmed === "") {
        continue;
      }
      const lower = trimmed.toLowerCase();
      if (lower === "exit" || lower === "quit") {
        console.log("再见。");
        break;
      }

      const history = sessionStore.get(sessionId) ?? [];
      const now = () => new Date().toISOString();

      const userMsg: ChatMessage = {
        id: randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: now(),
      };

      try {
        const out = await runRagChatTurn(
          {
            sessionId,
            userText: trimmed,
            history,
          },
          deps,
        );

        sessionStore.append(sessionId, userMsg);
        sessionStore.append(sessionId, {
          id: randomUUID(),
          role: "assistant",
          content: out.assistantText,
          createdAt: now(),
        });

        printTurnOutput(out, ragCfg);
      } catch (e) {
        const hint = explainApiError(e);
        if (hint) {
          console.error(hint);
        }
        console.error(e instanceof Error ? e.message : String(e));
        console.error("（本轮失败，可继续输入新问题。）\n");
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
