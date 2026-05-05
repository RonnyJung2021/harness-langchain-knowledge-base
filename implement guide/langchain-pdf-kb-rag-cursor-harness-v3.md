# 实现指南 v3：HTTP 服务端 + 网页多轮对话 + 知识库 PDF 替换（Harness + Cursor Agent）

> **读者**：已完成 v1（PDF RAG + `pnpm ask`）与 v2（`runRagChatTurn` + `pnpm chat` 多轮），希望将能力**对外以 HTTP 暴露**，并在本仓库内提供**可视化网页**：多轮对话 + **替换知识库 PDF**（上传或指定路径后重建向量）。  
> **Harness 对齐**：**任务契约**（REST JSON 与 v2 核心层一一对应）、**状态管理**（会话可内存/可落盘/可外存）、**工具边界**（HTTP 只做 IO；检索与模型调用仍经 `runRagChatTurn`）、**安全边界**（上传路径白名单、鉴权、限流）、**验证机制**（健康检查、E2E 冒烟）。  
> **部署前瞻**：后续整体 **Docker 化**并部署到**火山引擎**（公网可访问）时，镜像、环境变量、持久卷、负载均衡与 TLS 在本指南末阶段统一约束。  
> **技术定案（v3 锁定）**：**Node.js 20+、TypeScript** 全栈；HTTP 层固定 **Express**（路由、中间件、错误处理、静态资源）；前端固定 **Vite + 极简 React**（少量组件/单页即可，状态可用 `useState`/`useReducer`，避免过早引入重型状态库）。静态资源由 **Express `express.static` 托管 `web/dist`**（生产同源），或由前置反向代理托管（二选一文档说明）。  
> **前端交付要求**：实现完成后必须具备**可操作的验证路径**与**对用户可见的反馈**（见阶段 **O2**）：接口错误码展示、关键操作成功/失败提示；推荐再加 **Playwright（或等价）E2E 冒烟**，便于 CI 与回归。

---

## 0. v3 与 v2 的差异（读 2 分钟）

| 维度 | v2 | v3 |
|------|----|----|
| 入口 | 终端 `pnpm chat` | **HTTP 服务**监听端口；浏览器或任意客户端调用 |
| 交互 | readline | **网页 UI（极简 React）**：消息列表、输入框、可选「新会话」；操作结果有明确反馈，并可跑 E2E 冒烟 |
| 知识库 | 本地 `pnpm ingest -- <pdf>` | **网页或 API** 触发「替换 KB」：上传 multipart 或提交已校验的仓库内相对路径 |
| 状态 | 进程内 + 可选 `sessions/*.json` | 与 v2 **同形** `sessionId`；生产可换 Redis（接口形状不变） |
| 运维 | 本机 | **Dockerfile + compose**；火山引擎 **镜像仓库 + 计算 + CLB + HTTPS** |

**设计硬约束（与 v2 文档一致并强化）**：

- 业务深处**禁止**直接读 `req` / `res`；HTTP handler 只做：**解析 body → 校验 → 调已有核心（`runRagChatTurn`、ingest 核心函数）→ 写 JSON**。
- **替换 PDF** 属于写操作：必须 **鉴权**（至少 API Key 或内网 + mTLS）、**大小与 MIME 校验**、**路径防穿越**（与 `ingest.ts` 中 `resolvePdfPath` 思想一致：仅允许仓库根下白名单目录，例如 `kb_uploads/`）。

---

## 1. 打开 Cursor Agent 的标准姿势（与 v1/v2 相同）

1. **`⌘ + L`**（Windows/Linux：**`Ctrl + L`**）打开 Chat，切到 **Agent**。  
2. **完整粘贴**本指南对应步骤「**Agent 输入框粘贴**」区块。  
3. 批准终端/网络/写文件。  
4. 失败时：新开一条消息，首行「上一步失败」，粘贴**完整**终端报错与请求示例（curl 或浏览器 Network 截图文字）。

---

## 2. 阶段 L：HTTP 服务骨架与健康检查（任务表达 + 验证机制）

### L1. 引入 Web 框架与统一 JSON 错误体

**目的**：进程可对外监听；所有路由返回可预测的 JSON 结构，便于前端与运维探活。

**Harness 对齐**：**验证机制**（`/healthz`）；**错误分类**（4xx/5xx + `code` 字段，勿向客户端泄漏堆栈）。

**Agent 输入框粘贴**：

```text
在本仓库（已有 v2 runRagChatTurn、sessionStore、chat CLI）上增加 HTTP 服务骨架，技术选型固定为 Express：

1) 依赖：express、cors（若本步需要）；类型用 @types/express、@types/cors
2) 新建 src/server/app.ts（或 src/http/server.ts）：
   - 导出 createApp(): 返回配置好中间件与路由的 Express 应用实例
   - GET /healthz → 200 { "ok": true, "ts": "<ISO8601>" }（不调用方舟，避免探活扣费）
   - 使用 express.json()；全局 JSON 错误处理：未捕获异常映射为 500 { "error": { "code": "INTERNAL", "message": "..." } }；业务错误用 4xx + 稳定 code（可用自定义 Error 子类 + 中间件统一转换）
3) 新建 src/server/main.ts：读取 PORT（默认 8788），http.createServer(app).listen；优雅关闭 SIGTERM/SIGINT
4) package.json 增加 "serve": "tsx src/server/main.ts"（路径以实际为准）
5) 不要在本步实现聊天与上传，仅保证 pnpm run build 与 pnpm serve 可启动，curl /healthz 成功

验收：pnpm run build；pnpm serve 后 curl -s http://127.0.0.1:8788/healthz 返回 ok。
```

**验收标准**：

- `pnpm run build` 无报错；`pnpm serve` 可访问 `/healthz`。  
- 错误响应为 JSON，不返回完整 Node 堆栈给客户端。

**Harness 对齐**：**任务契约**（探活与错误形状先固定）；**反馈回路**（调用方可读 `code`）。

---

## 3. 阶段 M：会话 REST + 与 `runRagChatTurn` 对接（状态 + 工具边界）

### M1. 内存 SessionStore 复用与消息路由

**目的**：将 v2 的会话逻辑挂到 HTTP；`sessionId` 不透明 UUID；消息往返 JSON 与 v2 类型对齐。

**Harness 对齐**：**状态管理**；**工具治理**（handler 薄，核心厚）。

**Agent 输入框粘贴**：

```text
实现 REST 会话 API，复用现有 src/chat/sessionStore.ts 与 runRagChatTurn：

1) 在应用启动时创建单例 InMemorySessionStore（或封装为 ServerDeps 注入每个 handler）
2) 路由（路径与字段名全篇 camelCase）：
   - POST /v1/sessions → 201 { "sessionId": "<uuid>" }
   - GET /v1/sessions/:sessionId → 200 { "id", "messages": ChatMessage[] }；不存在 → 404
   - POST /v1/sessions/:sessionId/messages body: { "text": string } → 200 { "answer": string, "citations": CitationSummary[], "degraded"?: boolean }
3) POST messages 流程：
   - 校验 sessionId 为 UUID、body.text 非空且长度上限（如 8000 字符，可配置 env）
   - 从 store 取 history，调用 runRagChatTurn({ userText, sessionId, history })，deps 与 src/chat/cli.ts 同源组装（embeddings、vectorStore、ragConfig、createChat、buildSystemPrompt）
   - 将 user 与 assistant 消息 append 回 store（含 id 与 createdAt）；若已有 ARK_SESSION_PERSIST，保持与 CLI 一致写盘行为
4) 并发：同一 sessionId 连续请求若可能交错，用简单互斥锁（in-flight Promise map）或队列，避免消息顺序错乱
5) 新增 docs/KB_API.md（中文）：上述三端点 + 示例 curl；可选 src/chat/httpShape.ts 导出请求/响应 TypeScript 类型与文档一致

不要引入 ORM；不要在本步做用户登录 UI。

验收：pnpm serve；curl 创建 session → POST 两条 messages → GET 能看到两条 user 与两条 assistant；引用字段与 CLI 一致。
```

**验收标准**：

- 无浏览器亦可完成多轮：`POST` → `POST` → `GET` 消息条数正确。  
- `runRagChatTurn` 仍不依赖 `req`/`res`。

**Harness 对齐**：**任务表达**（HTTP body ↔ `RagTurnInput`）；**状态**（追加顺序可验证）。

### M2（可选）：CORS 与前端开发代理

**目的**：本地 Vite 开发时浏览器跨域访问 `8788`。

**Agent 输入框粘贴**：

```text
为 Express 增加可配置 CORS（使用 cors 包；env HTTP_CORS_ORIGINS 逗号分隔，开发默认 http://127.0.0.1:5173）。
生产环境建议同源（Express 托管 web/dist）或将 CORS 收紧为明确域名。
写入 .env.example 中文注释。
```

**验收标准**：

- 仅列出的 Origin 可带 cookie/鉴权头（若后续启用）；`*` 不得用于带凭证的生产配置。

**Harness 对齐**：**安全边界**（缩小暴露面）。

---

## 4. 阶段 N：知识库 PDF「替换」API（写操作 + 验证 + 与 ingest 对齐）

### N1. 将 ingest 主流程抽为可编程函数

**目的**：CLI `pnpm ingest` 与 HTTP「替换 KB」共用同一套分块、嵌入、写 `kb_store` 逻辑，避免两套代码漂移。

**Harness 对齐**：**验证机制**；**熵管理**（单一真相来源）。

**Agent 输入框粘贴**：

```text
重构 src/ingest.ts：把「从绝对路径 PDF 到写 manifest/vectors」抽成 async function ingestPdfFromAbsolutePath(args): Promise<{ sourceKey, chunkCount, ... }>
  - args 至少含：repoRoot, absPdfPath, arkConfig（或已有 loadArkConfig）
  - main() 仅解析 argv、resolvePdfPath、调用该函数
  - 保持与现逻辑一致的 replaceSourceAndEmbedNew / 维度校验

新增 src/server/kbReplace.ts（名称可调整）：
  - 对外 export async function replaceKnowledgeBaseFromUploadedFile(params): 写入 kb_uploads/<uuid>.pdf 后调用 ingestPdfFromAbsolutePath
  - 上传目录 kb_uploads/ 加入 .gitignore；保留 kb_uploads/.gitkeep

验收：pnpm ingest -- pdfs/sample.pdf 仍可用；从 ts 脚本或 vitest 直接调 ingestPdfFromAbsolutePath 可完成一次入库（可选 smoke）。
```

**验收标准**：

- `pnpm ingest` 行为与重构前一致（回归）。  
- 无 `process.argv` 深嵌在 ingest 核心路径内。

**Harness 对齐**：**工具边界**（ingest 可被子进程或 HTTP 调用）。

### N2. HTTP：multipart 上传替换 KB + 向量热加载

**目的**：网页「选择 PDF → 上传 → 等待完成 → 后续对话走新索引」。

**Harness 对齐**：**安全边界**（大小、类型、并发替换）；**错误分类**（嵌入失败可重试提示）。

**Agent 输入框粘贴**：

```text
实现 POST /v1/knowledge-base:replace（或 PUT /v1/knowledge-base）：
  - Content-Type: multipart/form-data，字段名 file，仅接受 application/pdf
  - 配置 KB_UPLOAD_MAX_BYTES（默认如 20MB），超出返回 413 + 稳定 code
  - 将文件落盘 kb_uploads/<uuid>.pdf，调用 ingestPdfFromAbsolutePath
  - 成功后：在服务端重新 loadVectorStore（与 ask/chat 同源工厂），并原子替换「当前服务进程」持有的 vectorStore 引用，使后续 runRagChatTurn 使用新索引；若加载失败回滚到旧索引并返回 500
  - 响应 200 { "sourceKey", "chunkCount", "replacedAt": ISO8601 }
  - 鉴权：本步至少实现 HTTP_ADMIN_TOKEN（Bearer），未匹配则 401；写入 .env.example

注意：ingest 期间应阻塞或排队第二个替换请求，避免 kb_store 并发写坏；可用简单 mutex。

验收：带 Bearer token curl 上传小 PDF 成功；紧接着 POST message 的回答应能引用新 PDF 中的独特片段（可人工准备测试 PDF）。
```

**验收标准**：

- 无 token 时 `401`。  
- 非 PDF / 超大文件被拒绝且 JSON `code` 稳定。  
- 替换完成后新对话检索命中新内容（可人工验证）。

**Harness 对齐**：**危险操作拦截**（鉴权 + 互斥 + 白名单目录）。

---

## 5. 阶段 O：可视化网页（多轮对话 + 替换 KB）

### O1. 极简 React + Vite 与 Express 同源托管

**目的**：单镜像部署时，浏览器只访问一个 origin（简化 CORS 与 Cookie）；技术栈与仓库定案一致（React + Express）。

**Harness 对齐**：**上下文组织**（前端不持有密钥；仅调同源 `/v1`）。

**Agent 输入框粘贴**：

```text
在本仓库增加 web/ 目录（Vite + TypeScript + React，保持极简）：
  - 依赖：react、react-dom；开发 @vitejs/plugin-react；构建目标为 web/dist
  - 入口：单页或 2～3 个小组件即可（如 App.tsx、ChatPanel.tsx、KbReplacePanel.tsx），禁止为演示引入 Redux 等重型方案
  - 页面：左侧或顶部「当前 session」显示 sessionId；按钮「新会话」调用 POST /v1/sessions
  - 中间：消息列表（user/assistant），底部输入框发送 POST /v1/sessions/:id/messages；展示 citations 折叠区或脚注
  - 「替换知识库」：<input type=file accept=application/pdf> + 上传按钮调用 POST /v1/knowledge-base:replace；开发环境可用 Vite 环境变量注入 Bearer（README 标明**勿提交**）；生产环境优先**短期票据 / 同源 Cookie 会话 / 网关鉴权**，避免将长期 HTTP_ADMIN_TOKEN 编译进前端静态包
  - 开发：Vite server 将 /v1 代理到 http://127.0.0.1:8788（与 pnpm serve 一致）
  - 生产：pnpm build:web 产出 web/dist；Express 在注册 /v1 路由之后使用 express.static("web/dist")，并对 SPA 使用 fallback 到 index.html（注意 /v1 不得被 fallback 吞掉）
  - package.json 增加 build:web、dev:web；根 README 简短说明「双终端：serve + dev:web」

不在前端写 ARK_API_KEY；所有模型调用走服务端。

验收：本地双进程可完整走通多轮 + 上传替换；生产构建后单 pnpm serve 可打开页面且 API 正常。
```

**验收标准**：

- 网络面板中请求仅指向同源或 dev proxy，**无**方舟密钥暴露。  
- UI 能展示 `citations` 与 `degraded`（若有）。

**Harness 对齐**：**安全边界**（密钥仅在服务端 env）。

### O2. 前端完成后的验证与反馈（必做）

**目的**：Human 与 CI 都能**确认前端可用**；用户在页面上能**看到每一步结果**（成功、失败原因、可重试提示），对齐 Harness **验证机制**与**反馈回路**。

**Harness 对齐**：**验证机制**（可重复执行的检查）；**反馈回路**（错误 `code`、HTTP 状态、耗时可见，而非静默失败）。

**Agent 输入框粘贴**：

```text
在 web/ 极简 React 应用中增加「验证 + 反馈」能力（与阶段 L/M/N 接口对齐）：

A) 用户可见反馈（必做）
  - 所有 fetch：根据 HTTP 状态与 body.error.code 展示明确文案（401/413/429/500 区分）；网络失败单独提示
  - 发送消息、上传 PDF：loading 态禁用按钮；成功 toast 或内联成功条（含关键字段如 chunkCount、message 条数）
  - 空 session、未上传即提问等边界：按钮禁用或 inline 提示，避免无效点击

B) 页内「自检」或诊断区（必做其一）
  - 方案 1：折叠面板「连接自检」：顺序请求 GET /healthz → POST /v1/sessions →（可选）POST 一条短消息或仅 GET session；每一步显示 ✓/✗、HTTP 状态、耗时 ms；失败时展示服务端返回的 message/code（脱敏）
  - 方案 2：开发环境仅在 import.meta.env.DEV 显示诊断条，生产构建关闭（须在 README 说明）

C) 自动化 E2E（强烈推荐，便于完成后一键验证）
  - 使用 @playwright/test；webServer 配置同时拉起 API（或文档说明先 pnpm serve 再 playwright test）
  - 至少 1 条用例：打开首页 → 点击新会话（或依赖默认）→ 输入框发送固定短句 → 断言页面出现 assistant 区域或非空回答占位（若 CI 无方舟密钥，可用 MSW mock /v1 或跳过并文档标注 required secrets）
  - package.json 增加 "test:e2e": "playwright test"；可选 CI job 仅在有 secrets 时跑

验收：人工在 UI 上能一眼看到上次操作成功或失败原因；本地 pnpm test:e2e 在约定前提下通过（或 mock 模式下通过）。
```

**验收标准**：

- 故意填错 Admin Token 或断网时，UI 有**明确错误反馈**，不白屏、不无限 loading。  
- 「连接自检」或等价能力可在 30 秒内确认服务端与 API 前缀正常。  
- `pnpm test:e2e` 在文档描述的条件下可稳定通过（真实 API 或 mock 二选一写清）。

**Harness 对齐**：**错误分类**（用户可理解的原因）；**验证**（E2E 或自检面板作为交付证据）。

### O3. 可选体验：流式输出（SSE）

**目的**：长回答时逐字显示（非 v3 必须；若做则单独一步以免阻塞主线）。

**Harness 对齐**：**反馈回路**（分块到达 vs 一次性 JSON）。

**Agent 输入框粘贴**（可选）：

```text
若需流式：新增 POST /v1/sessions/:id/messages:stream，使用 Server-Sent Events，最后一帧附带 citations JSON。
须与现有非流式 POST 并存；文档标明客户端用法；React 端用 EventSource 或 fetch 流解析。
```

---

## 6. 阶段 P：生产级加固清单（上线前打勾）

**目的**：公网暴露时最小安全面。

**Harness 对齐**：**安全与审批**；**错误分类**；**验证**。

**Agent 输入框粘贴**：

```text
按清单实现或文档化（未实现项在 README「生产 checklist」打勾留空）：

1) 速率限制：按 IP + 可选按 sessionId 对 POST /messages 限流（使用 express-rate-limit）
2) 请求体大小限制：与 KB 上传上限区分，JSON 路由单独更小
3) 日志：结构化日志（pino），禁止打印完整用户 PDF 内容与完整 prompt；错误 id 关联
4) 超时：方舟调用设置合理 timeout；超时返回 504 + 可重试 hint
5) readiness：可选 GET /readyz 尝试轻量检查（如 kb_store manifest 可读），与 /healthz 区分

.env.example 增补 HTTP_ADMIN_TOKEN、PORT、CORS、限流相关变量说明。
```

**验收标准**：

- 压测或连续请求触发 429（若已启用限流）。  
- 日志无密钥、无完整用户文件落盘。

**Harness 对齐**：**工具治理**（可观测、可审计）。

---

## 7. 阶段 Q：Docker 化（为火山引擎与公网访问做准备）

### Q1. Dockerfile 与 compose

**目的**：可重复构建、非 root、单容器同时跑 Node API + 挂载静态 `web/dist`。

**Harness 对齐**：**稳定**（镜像可版本化）；**状态**（卷挂载 `kb_store`、`sessions`、`kb_uploads`）。

**Agent 输入框粘贴**：

```text
新增多阶段 Dockerfile：
  - stage1：pnpm install --frozen-lockfile（或 npm ci）、pnpm run build、pnpm run build:web
  - stage2：node:20-alpine，复制 node_modules 与编译产物与 web/dist，USER node
  - ENV NODE_ENV=production
  - EXPOSE 8788
  - CMD ["node","dist/server/main.js"]（以实际编译输出为准；若用 tsx 生产不推荐）

新增 docker-compose.yml（开发/演示用）：
  - 卷：./kb_store:/app/kb_store、./sessions:/app/sessions、./kb_uploads:/app/kb_uploads
  - env_file: .env
  - ports: 8788:8788

根目录 .dockerignore：忽略 .git、node_modules、.env、大 PDF 测试文件等

验收：docker compose up --build 后本机可访问页面与 /v1；容器重启后会话是否保留取决于是否挂载 sessions（文档说明）。
```

**验收标准**：

- 镜像内不以 root 运行主进程。  
- `docker compose` 一键起服务，健康检查可通过（可在 compose 里配 `healthcheck` curl）。

**Harness 对齐**：**验证机制**（compose healthcheck）。

---

## 8. 阶段 R：火山引擎云上部署要点（公网可访问）

> 以下为**云架构约束与操作要点**，具体控制台菜单名以火山引擎当时文档为准；实施时在团队内固定「镜像 + 计算 + 入口 + 证书」四件套即可。

### R1. 镜像与计算

**目的**：把 Q 阶段镜像推到火山**容器镜像服务（CR）**，计算选用 **VKE（托管 K8s）** 或 **ECS/实例 + 容器运行** 二选一。

**Harness 对齐**：**环境系统**（运行时可替换；Harness 契约不变）。

**人工/Agent 协作清单**（可拆为独立任务）：

1. 在火山 CR 创建命名空间与镜像仓库；CI 或本地 `docker tag` + `docker push`。  
2. 将 `ARK_*`、`HTTP_ADMIN_TOKEN`、`PORT` 等写入火山 **Secret 管理**或环境注入，**禁止**把 `.env` 打进镜像。  
3. CPU/内存：按嵌入批次与并发预估；上传大 PDF 时嵌入为 CPU+网络密集，适当限并发 ingest。  
4. 出口访问：确保计算节点可访问方舟 OpenAI 兼容域名（企业网络策略放行）。

**验收标准**：

- 云上实例 `curl localhost:8788/healthz` 成功；从办公网经 CLB 访问成功（见 R2）。

### R2. 公网入口、TLS 与 CLB

**目的**：HTTPS 终止在负载均衡或 Ingress；后端可保持 HTTP。

**要点**：

- 使用火山 **负载均衡（CLB）** 或 K8s Ingress，绑定公网 IP 与证书（TLS 1.2+）。  
- `client_max_body_size` 或等价配置须 **≥ KB_UPLOAD_MAX_BYTES**，否则上传被网关截断。  
- 配置 **空闲超时** 大于长回答生成时间（若走 SSE 更长）。

**验收标准**：

- `https://你的域名/healthz` 返回 200；浏览器无混合内容警告。

### R3. 持久化与多副本注意

**目的**：避免多副本共享本地文件系统导致会话与 kb_store 不一致。

**要点**：

| 组件 | 单副本 | 多副本 |
|------|--------|--------|
| `kb_store` | 挂载云盘 / NAS | 需单一写入者或对象存储 + 启动时拉取；**推荐** ingest 与 chat 分离队列化 |
| `sessions` | 同上 | 迁移到 **Redis** 等外置会话存储 |
| 内存 SessionStore | 仅单进程有效 | 必须外置 |

**v3 MVP 建议**：首版云上 **单副本 + 云盘挂载** `kb_store` 与 `sessions`，在 README 标明「多副本需 Redis 与共享存储方案」。

**Harness 对齐**：**状态管理**（部署拓扑与存储策略一致）。

---

## 9. v3 总验收清单（交付前打勾）

- [ ] **HTTP**：`/healthz` 可用；会话三端点与 `docs/KB_API.md`（及可选 `httpShape.ts`）一致。  
- [ ] **核心层**：handler 不泄漏实现细节；`runRagChatTurn` 与 ingest 核心可被 CLI 与 HTTP 共用。  
- [ ] **替换 KB**：鉴权、大小/MIME 校验、互斥、替换后检索使用新向量。  
- [ ] **网页**：多轮对话 + 上传替换 PDF 全流程可走通（本地 dev proxy 或生产同源）；**错误与成功反馈**清晰；**自检或 E2E** 至少一种可重复验证方式已落地。  
- [ ] **密钥**：浏览器与仓库中均无 `ARK_API_KEY`；仅服务端环境变量。  
- [ ] **Docker**：`docker compose up --build` 可运行；非 root；卷挂载说明文档化。  
- [ ] **火山引擎**：镜像推送、Secret、CLB+HTTPS、上传大小限制已核对（至少文档级 checklist 已完成）。

---

## 10. Harness 自检表（v3 增补）

| 要素 | v3 检查项 |
|------|-----------|
| 任务表达 | REST body 是否可无歧义映射到 `RagTurnInput` / ingest 参数？ |
| 上下文组织 | 前端是否只提交 `text`，不把整份 PDF 当 prompt 发送？ |
| 工具治理 | 上传、ingest、chat 是否分离路由与权限？ |
| 状态管理 | 会话是否在多副本场景下有明确策略（单副本 MVP 或 Redis）？ |
| 反馈回路 | `citations` 与错误 `code` 是否到达前端与日志？ |
| 安全边界 | 鉴权、限流、路径白名单、上传上限是否落在运行时？ |
| 验证机制 | 健康检查、替换后检索验证、镜像 smoke 是否具备？前端自检或 Playwright 是否可重复跑通？ |

---

## 11. 文档版本与依赖

- **前置**：`implement guide/langchain-pdf-kb-rag-cursor-harness.md`（v1）、`implement guide/langchain-pdf-kb-rag-cursor-harness-v2.md`（v2）。  
- **本文档**：v3，面向 **Express + 极简 React + Docker + 火山引擎** 交付路径；具体包版本以仓库 `package.json` 为准。  
- **执行顺序建议**：L → M → N1 → N2 → O1 → **O2（验证与反馈）** → P → Q → R；流式 **O3** 与 M2 可按需插入。
