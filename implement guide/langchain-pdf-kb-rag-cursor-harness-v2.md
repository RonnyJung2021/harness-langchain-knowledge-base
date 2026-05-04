# 实现指南 v2：多轮对话 CLI + 面向未来 HTTP 的契约设计（Harness + Cursor Agent）

> **读者**：已完成 v1（`langchain-pdf-kb-rag-cursor-harness.md`）或等价功能，希望在本机终端**连续多轮**与同一知识库对话，且代码结构**不绑死 CLI**，便于后续增加对外 HTTP 接口。  
> **Harness 对齐**：显式**任务契约**（单次「一问一答」的输入输出）、**状态管理**（会话消息与可选 sessionId）、**上下文裁剪**（历史 + RAG 片段总长度可控）、**工具边界**（检索与模型调用集中在可单测的核心层）。  
> **技术定案**：延续 v1——Node.js 20+、TypeScript、LangChain.js、本地向量库、方舟 OpenAI 兼容接口；v2 **不强制**引入 Web 框架，但要求抽象出 **「无 stdin/无 HTTP 也可调用」的核心函数**，HTTP 仅作为未来薄适配层。  
> **协作方式**：用 **Cursor Agent** 粘贴各步指令；你负责批准运行与按验收标准核对。

---

## 0. v2 与 v1 的差异（读 1 分钟）

| 维度 | v1 | v2 |
|------|----|----|
| 交互 | `pnpm ask -- "一句话"` 单次退出 | 终端内**循环**输入多轮，或显式 `quit` 退出 |
| 状态 | 无会话 | **会话**：消息列表（user/assistant），可选内存或落盘 |
| RAG | 每请求一次检索 | **默认每轮用户发言后重新检索**（追问仍贴合知识库）；可选「首轮检索、后续仅聊天」作为配置项 |
| 扩展 | CLI 即主流程 | **核心层** `runRagChatTurn(...)`（名称可自定）与 **CLI 循环** 分离，未来 `POST /v1/sessions/:id/messages` 只调核心层 |

**未来 HTTP 兼容要点（设计约束，不必本步全实现）**：

- 用 **opaque `sessionId`**（UUID）标识会话；服务端用 `Map` 或 Redis 存 `ChatSessionState`。
- **单次模型调用的输入**固定为：`{ sessionId, userText, historySnapshot?, retrievalConfig }` → **输出**：`{ assistantText, citations, usageMeta? }`。
- **禁止**在业务深处直接读 `process.argv` 或 `req`；CLI 与 HTTP 只做 IO，**组装参数 → 调核心 → 打印/JSON 返回**。

---

## 1. 打开 Cursor Agent 的标准姿势（与 v1 相同）

1. **`⌘ + L`**（Windows/Linux：**`Ctrl + L`**）打开 Chat，切到 **Agent**。  
2. **完整粘贴**本指南对应步骤「**Agent 输入框粘贴**」区块。  
3. 批准终端/网络/写文件。  
4. 失败时：新开一条消息，首行「上一步失败」，粘贴**完整**终端报错。

---

## 2. 阶段 G：会话模型与「单次对话轮」契约（任务表达 + 状态）

### G1. 定义类型与纯数据结构

**目的**：把「多轮」从终端循环里抽出来，变成可序列化、可将来放入 API body 的数据。

**Harness 对齐**：**任务契约无歧义**；状态可被 HTTP 层原样传递或从 store 按 `sessionId` 加载。

**发一条 Agent 任务**，粘贴：

```text
在本仓库（已有 PDF RAG + ask 单轮）上增加 v2 多轮对话的数据契约，不要求改 CLI 行为前先完成类型与常量：

1) 新建 src/chat/sessionTypes.ts（或你认可的同级路径），导出：
   - ChatRole: 'user' | 'assistant' | 'system'（若 system 仅内部注入可标注）
   - ChatMessage: { id: string; role: ChatRole; content: string; createdAt: string(ISO) }
   - CitationSummary: 与当前 ask 打印的「文件名、chunk、分数、前80字」对齐的字段化结构（便于将来 JSON 返回）
   - RagTurnInput: { userText: string; sessionId: string; history: ChatMessage[] } 以及嵌入模型/仓库根路径所需字段通过已有 config 在调用方注入，不要把 process.env 塞进类型文件
   - RagTurnOutput: { assistantText: string; citations: CitationSummary[]; degraded?: boolean }

2) 新建 src/chat/ragTurn.ts，导出 async function runRagChatTurn(input: RagTurnInput, deps: RagTurnDeps): Promise<RagTurnOutput>
   - RagTurnDeps 至少包含：embeddings、vectorStore（或封装好的 retrieve 函数）、createChat 工厂、loadRagRetrievalConfig 的结果、buildSystemPrompt 策略（可先内联字符串模板）
   - 实现逻辑：用 input.userText 做向量检索（与现 ask.ts 相同 topK/阈值）；将检索结果格式化为【参考资料】块；拼接 **system**（沿用现 ask 的规则：只根据资料答、不足则说不知道）+ **history 中最近 N 条**（N 用常量如 20，可配置）+ 当前 user 消息；调用 ChatOpenAI.invoke；解析 assistant 文本
   - **不要**在 runRagChatTurn 内 console.log；由调用方负责打印
   - 从 ask.ts 抽取可复用的「formatCitation、buildContextBlock、explainApiError」等到合适模块，避免重复

3) pnpm run build 通过；单轮行为可通过写一个很小的 vitest 或临时 ts 脚本 mock deps 测 runRagChatTurn（可选，若加测试须 pnpm 脚本）

验收：存在 runRagChatTurn 与清晰类型；ask.ts 可改为调用该函数且单轮 CLI 行为与改前一致（引用块 + 回答）。
```

**验收标准**：

- `pnpm run build` 无报错。
- `runRagChatTurn` 签名中**不出现** `process.stdin` / `express` / `hono`。
- 单轮 `pnpm ask -- "..."` 输出格式与 v1 实质一致（引用摘要 + 回答）。

**Harness 对齐**：**任务表达**（RagTurnInput/Output）与 **状态**（history + sessionId）显式化，为持久化与 API 做准备。

---

## 3. 阶段 H：内存会话存储 + 终端 REPL（反馈回路）

### H1. SessionStore 与 CLI 循环

**目的**：终端里可连续提问；会话仅存内存（进程退出即失），但接口形状与未来 Redis 一致。

**Harness 对齐**：**状态管理**；进程边界清晰（本步不要求跨进程恢复）。

**发一条 Agent 任务**，粘贴：

```text
实现终端多轮对话，并与 runRagChatTurn 对接：

1) 新建 src/chat/sessionStore.ts：
   - createInMemorySessionStore(): { createSession(): string; get(id): ChatMessage[] | undefined; append(id, msg): void }
   - sessionId 使用 crypto.randomUUID()
   - 同一 session 内维护 messages: ChatMessage[]（user 与 assistant 交替追加）

2) 修改或新增入口：推荐保留 pnpm ask 单轮兼容；新增 pnpm chat 指向 tsx src/chat/cli.ts（或 src/chatRepl.ts）
   - chat 启动时：createSession()，打印一行说明：输入问题回车发送，输入 exit 或 quit 或 Ctrl+D 退出
   - 每轮：readline 读一行 → trim → 空行跳过 → exit/quit 退出
   - 调用 runRagChatTurn({ sessionId, userText, history: store.get(sessionId) 的副本或已存列表 })，deps 从现有 config + loadVectorStore 等组装（与 ask 同源）
   - 将 user 与 assistant 消息 append 回 store（带新 id 与时间戳）
   - 终端打印：引用摘要区块 + 回答（与现 ask 风格一致）

3) package.json scripts 增加 "chat": "tsx src/chat/cli.ts"（路径以你实际文件为准）

4) 错误处理：runRagChatTurn throw 时打印 explainApiError，不崩溃退出整个 REPL（除非用户 Ctrl+C）；记录 process.exitCode 仅在最终退出时按需

pnpm run build；手动运行 pnpm chat 至少两轮追问验证引用仍更新。

验收：同一进程中两轮以上对话；第二轮能引用上一轮话题相关的检索（若知识库有内容）。
```

**验收标准**：

- `pnpm chat` 可启动，多轮输入正常。
- 输入 `quit` / `exit` 干净退出。
- 每轮用户消息后仍执行检索（日志或调试用可选开关打印 topK 命中来源名）。

**Harness 对齐**：**反馈回路**（每轮可见引用）；**错误分类**（网络/鉴权提示不吞掉）。

---

## 4. 阶段 I：上下文裁剪与熵管理（长会话不爆 token）

### I1. 历史窗口 + 参考资料预算

**目的**：会话变长时，控制送入模型的 token；行为可配置，与将来 API 的 `maxHistory` 查询参数对齐。

**Harness 对齐**：**熵管理**；**上下文组织**（只传高价值近期消息）。

**发一条 Agent 任务**，粘贴：

```text
在 runRagChatTurn 或独立 assembleMessages 函数中实现裁剪策略：

1) 环境变量（写入 .env.example 中文注释）：
   - ARK_CHAT_MAX_HISTORY_MESSAGES：默认 20，表示参与模型调用的最近消息条数（只计 user+assistant，不含本轮 user）
   - ARK_RAG_CONTEXT_MAX_CHARS：默认 12000，对【参考资料】拼接总字符上限，超出则按片段顺序截断并标记「后略」

2) 实现规则：
   - history 先按时间排序，取尾部满足条数限制
   - system（含参考资料）单独一条；不要把整本书无界拼进 system
   - 若 LangChain 消息类型需转换，使用 HumanMessage / AIMessage / SystemMessage

3) README 或 docs/KB_OPERATIONS.md 增加一小节「多轮与裁剪」说明上述变量

pnpm run build。
```

**验收标准**：

- 人为把 `ARK_CHAT_MAX_HISTORY_MESSAGES` 设为很小（如 2），多轮后模型仍只收到最近上下文（可通过临时 debug 日志或单测断言组装的 messages 长度）。
- 参考资料超长时回答仍返回、不出现未处理异常。

**Harness 对齐**：**上下文裁剪**可验证、可调参。

---

## 5. 阶段 J（可选但强烈推荐）：落盘会话快照（可恢复 + 对接 API 更容易）

### J1. 按 sessionId 写入 kb_store 旁或 sessions/ 目录

**目的**：进程重启后可加载同一会话（可选）；HTTP 层可「无状态 worker + 外存」扩展。

**Harness 对齐**：**状态落盘**；**可恢复**。

**发一条 Agent 任务**，粘贴：

```text
增加可选会话持久化：

1) 目录 sessions/（加入 .gitignore，保留 sessions/.gitkeep），文件命名 {sessionId}.json
2) 结构：{ id, createdAt, updatedAt, messages: ChatMessage[] }，UTF-8 JSON
3) env：ARK_SESSION_PERSIST=1 时，sessionStore 在每次 append 后写盘；启动 chat 时若支持传入 --resume <sessionId> 则加载（不支持也可仅做写盘）
4) 安全：禁止路径穿越；sessionId 必须为 UUID 格式校验不过则拒绝

README 说明默认不持久化、开启方式与隐私提示（会话可能含敏感提问）。

pnpm run build。
```

**验收标准**：

- `ARK_SESSION_PERSIST=1` 时两轮对话后磁盘出现对应 JSON。
- UUID 校验生效。

**Harness 对齐**：**验证机制**（文件存在且 JSON 可解析）；**安全边界**（文件名即 id，防穿越）。

---

## 6. 阶段 K：为未来 HTTP 预留的薄层（本步可不监听端口）

### K1. 文档化 REST 形状 + 可选空实现

**目的**：你或团队下一步加 `hono`/`express` 时不必推翻 CLI 结构。

**Harness 对齐**：**工具治理**（HTTP 仅 IO）；**任务契约**稳定。

**发一条 Agent 任务**，粘贴：

```text
在 docs/ 下新增 KB_API_FUTURE.md（中文），用「拟议」语气写清未来 REST，不要求本仓库已实现：

1) POST /v1/sessions → 201 { sessionId }
2) POST /v1/sessions/:sessionId/messages body: { text: string } → 200 { citations, answer, degraded? }
3) GET /v1/sessions/:sessionId → 200 { messages }（若未做持久化可标注 MVP 仅内存）
4) 鉴权、速率限制、PDF 路径白名单（参考 v1 阶段 F）列为生产必备清单

同时在 src/chat/ 增加 httpShape.ts：仅导出 TypeScript 类型（RequestBody / ResponseBody），与文档一致，供将来 import。

不要在本步引入真实 HTTP 依赖，除非用户明确要求。
```

**验收标准**：

- `docs/KB_API_FUTURE.md` 与 `src/chat/httpShape.ts` 字段命名一致（camelCase 或 snake_case 二选一并全篇统一）。
- `pnpm run build` 仍通过。

**Harness 对齐**：**验证**（契约可先于实现存在）；避免「先写路由再反推契约」的熵增。

---

## 7. v2 总验收清单（交付前打勾）

- [ ] **任务契约**：`RagTurnInput` / `RagTurnOutput` 与 `runRagChatTurn` 为单一真相来源；CLI 与将来 HTTP 共用。  
- [ ] **状态**：多轮 `history` 正确追加；`sessionId` 全程传递。  
- [ ] **RAG**：默认每轮用户输入后检索；弱相关时有 `degraded` 或等价提示。  
- [ ] **裁剪**：`ARK_CHAT_MAX_HISTORY_MESSAGES` 与 `ARK_RAG_CONTEXT_MAX_CHARS` 生效且有文档。  
- [ ] **错误**：单轮 API 失败不必然杀死整个 REPL（除用户主动退出）。  
- [ ] **兼容**：保留 `pnpm ask` 单轮入口或明确废弃说明（若废弃须在 README 大字号提示）。  
- [ ] **未来 API**：`docs/KB_API_FUTURE.md` + `httpShape.ts` 已对齐。

---

## 8. Harness 自检表（v2 增补）

| 要素 | v2 检查项 |
|------|-----------|
| 任务表达 | 单次 `runRagChatTurn` 的输入输出是否可无歧义映射到 HTTP body？ |
| 上下文组织 | system（资料）与 history 是否分离装配、是否可截断？ |
| 状态管理 | session 是否可用 `sessionId` 定位、是否可外存？ |
| 反馈回路 | 每轮是否仍暴露 citations 给人或调用方审计？ |
| 验证机制 | `pnpm chat` 手动两轮 + `pnpm ask` 单轮回归是否均通过？ |

---

## 9. 文档版本与依赖

- **前置**：`implement guide/langchain-pdf-kb-rag-cursor-harness.md`（v1）。  
- **本文档**：v2，2026 年与 LangChain.js / Cursor Agent 工作流对齐；包名与 API 以你仓库已锁定版本为准。  
- **不必重读**：v1 中阶段 A–F 已完成则 v2 从阶段 G 开始执行即可。
