# Repository Atlas: kb-rag-local

> **实际路径**：`project-atlas/REPOSITORY_ATLAS.md`（技能默认路径为 `docs/REPOSITORY_ATLAS.md`，按约定放在仓库根目录新建文件夹）。  
> 生成日期：2026-05-05 · 本文件与具体功能需求无关，仅作仓库级参考。  
> 扫描未写入任何 `.env` 或密钥内容。

## 1. 摘要

- **业务侧一句话**：本地 PDF 知识库入库与问答（RAG），默认对接火山方舟 API，支持服务端离线桩模式、**端内完全离线**（同步快照 + 本机 RAG）与可选会话落盘。
- **技术侧一句话**：pnpm monorepo（ESM + TypeScript strict），`@kb-rag/api-core` 承载 LangChain 流水线；`kb-rag-server`（Express）提供同源 REST + 可选托管 Vite 产物；Web（Vite + React + react-native-web）与 Mobile（Expo + RN）共享 **`@kb-rag/app-shared`**、**`@kb-rag/client-offline-core`** 与 **`@kb-rag/design-system`**。

## 2. 仓库拓扑

| 类型 | 说明 |
|------|------|
| **Monorepo / 单包** | Monorepo：`pnpm-workspace.yaml` 声明 `apps/*`、`packages/*`。 |
| **包管理器** | pnpm；根 `package.json` + `pnpm-lock.yaml`（lockfileVersion 9）。 |

### 顶层目录职责表（包 / 应用粒度）

| 路径 | 职责（一句） |
|------|----------------|
| `apps/server` | HTTP 服务：探活、`/v1` 会话与知识库替换、可选静态 SPA + fallback；依赖 `api-core`、`shared`。 |
| `apps/web` | Vite + React 18 浏览器端；`react-native` 解析到 `react-native-web`；代理 `/v1`、`/healthz`、`/readyz` 到本机 API。 |
| `apps/mobile` | Expo 52 + RN 0.76 客户端；复用 `app-shared` / `design-system`；`EXPO_PUBLIC_*` 配置 API 基址与上传鉴权。 |
| `packages/api-core` | PDF 解析、向量存储、ingest/ask/chat CLI、RAG 轮次、方舟/离线 Provider；编译产物供 server 与脚本引用。 |
| `packages/shared` | 跨端 HTTP 形状、错误类型、端内离线 UI 文案码等共享库（tsc 产出 `dist`）。 |
| `packages/client-offline-core` | 端内离线 RAG 内核：桩嵌入、余弦检索、`runLocalRagTurn`、`KbBundleStore`（Web IndexedDB 等）；**无 Node 专属 API**，供 `app-shared` / Web 注入使用。 |
| `packages/app-shared` | Web/RN 共用业务 UI 与 hooks（peer：`react`、`react-native`）。 |
| `packages/design-system` | 共用设计系统 primitive（peer 同 app-shared）。 |
| `scripts/` | 烟测入库、smoke PDF 生成等辅助脚本。 |
| `e2e/` | Playwright 端到端用例（根 `playwright.config.ts`）。 |
| `docs/` | 运维、API、生产安全等既有文档（如 `KB_API.md`、`KB_OPERATIONS.md`、`PRODUCTION_SECURITY_V4.md`）。 |
| `pdfs/`、`kb_store/`、`sessions/`、`kb_uploads/` | 运行时数据与约定路径（详见根 `README.md`）。 |

**说明**：`apps/mobile/ios/Pods/` 等为原生依赖生成物，图谱不展开子树。

## 3. 入口与运行形态

### 入口列表（命令 / 路径）

| 入口 | 证据 |
|------|------|
| 全仓构建 | 根 `pnpm run build` → `pnpm -r run build`。 |
| API 服务 | `pnpm serve` → `kb-rag-server` 的 `tsx src/main.ts`（`apps/server/src/main.ts`）。 |
| Web 开发 | `pnpm dev:web` → `kb-rag-web` 的 `vite`（默认 5173）。 |
| Mobile 开发 | `pnpm dev:mobile` → 先构建若干 workspace 包再 `expo start`（根脚本链）。 |
| 入库 / 问答 CLI | `pnpm ingest`、`pnpm ask`、`pnpm chat` → `@kb-rag/api-core` 脚本。 |
| E2E | `pnpm test:e2e`（可选 `E2E_SKIP=1` 跳过 webServer）。 |

### 单入口 / 多入口

- **多入口**：CLI（api-core）、HTTP 服务（server）、Web SPA（web）、原生壳（mobile）并行存在。

### 客户端

- **Web**：`apps/web`（Vite），入口 `apps/web/src/main.tsx`。
- **RN iOS / Android**：`apps/mobile`（Expo），入口 `apps/mobile/App.tsx`。

### 服务端

- **有**：`apps/server`，Express 5 + Node HTTP；RAG 与存储逻辑委托 `@kb-rag/api-core`（见 `main.ts` 中 `loadKbRagContext`、`createRagDeps` 等）。

## 4. 技术栈与版本证据

| 类别 | 选型 | 证据（文件） |
|------|------|----------------|
| 语言 / 模块系统 | TypeScript ~5.7.2、ESM `type: module` | 根与各包 `package.json`；`pnpm-lock.yaml` 解析版本如 `typescript@5.7.2` |
| TS 编译选项 | `strict`、`verbatimModuleSyntax`、`noUnusedLocals/Parameters` 等 | `tsconfig.base.json` |
| 运行时（镜像） | Node 20 Alpine | `Dockerfile`：`FROM node:20-alpine` |
| Web 框架 | React ^18.3.1、Vite ^6.0.3 | `apps/web/package.json` |
| RN / Expo | RN 0.76.7、Expo ~52.0.31 | `apps/mobile/package.json`；锁文件中有解析版本 |
| RN Web 桥 | react-native-web ^0.19.13（仅 web 包） | `apps/web/package.json` |
| HTTP 服务 | express ^5.2.1、cors、multer、pino、pino-http、express-rate-limit | `apps/server/package.json` |
| RAG / AI | langchain、@langchain/*、pdfjs-dist | `packages/api-core/package.json` |
| E2E | @playwright/test ^1.49.1（锁文件解析如 1.59.1） | 根 `package.json`、`pnpm-lock.yaml` |
| 脚本运行时 | tsx ^4.19.2 | 根与各 app 的 `package.json` |

## 5. 功能域与模块关系（高层）

### 域或包（按职责）

- **ingest / 向量库**：`packages/api-core`（PDF → chunk → 嵌入 → `kb_store`）。
- **对话与会话**：`api-core` 的 chat/RAG 轮次 + `apps/server` 的 `/v1/sessions` 路由与内存会话存储。
- **知识库替换**：`api-core` 的 replace + `apps/server` 的 `/v1` 下 KB 路由（见 `app.ts` 挂载）。
- **跨端 UI**：`design-system` → `app-shared` → `web` / `mobile`；`web` 通过 Vite alias 直连 **`app-shared` / `client-offline-core` / `shared`** 等 workspace 源码路径。
- **端内离线**：`client-offline-core`（检索 + 占位回答 + 存储抽象）由 `app-shared` 组合；`web` 在入口注入 IndexedDB `KbBundleStore`，`mobile` 注入 RN 文件系统实现。

### 引用关系（依赖方向）

- `kb-rag-server` → `@kb-rag/api-core`、`@kb-rag/shared`
- `kb-rag-web` → `@kb-rag/app-shared`、`@kb-rag/client-offline-core`、`@kb-rag/design-system`、`@kb-rag/shared`
- `kb-rag-mobile` → `@kb-rag/app-shared`、`@kb-rag/design-system`、`@kb-rag/shared`
- `@kb-rag/app-shared` → `@kb-rag/client-offline-core`、`@kb-rag/design-system`、`@kb-rag/shared`
- `@kb-rag/api-core` → `@kb-rag/shared`
- **Docker 生产镜像**：仅复制并构建 `shared`、`api-core`、`server`、`web`（见根 `Dockerfile`）；**不包含** `apps/mobile` 产物。

## 6. 强约束

- **pnpm workspace 与安装行为**：工作区由 `pnpm-workspace.yaml` 定义；根 `package.json` 的 `pnpm.onlyBuiltDependencies` 含 `esbuild`；`pnpm-workspace.yaml` 的 `allowBuilds` 声明 `esbuild`、`sharp`。证据：根 `package.json`、`pnpm-workspace.yaml`。
- **ESM**：根与主要包声明 `"type": "module"`。证据：根 `package.json`。
- **TypeScript 严格模式**：`strict: true` 及未使用检查等。证据：`tsconfig.base.json`。
- **Docker 构建冻结锁文件**：`pnpm install --frozen-lockfile`。证据：`Dockerfile`。
- **生产容器运行用户**：最终阶段 `USER node`。证据：`Dockerfile`。
- **服务端默认端口**：`8788`（可被 `PORT` 覆盖）。证据：`apps/server/src/main.ts`。
- **Playwright 无跳过时的本地端口约定**：API 默认 `E2E_API_PORT`（18790）与 Vite 5173。证据：`playwright.config.ts`。

## 7. 弱约束与代码组织

- **目录命名**：`apps/` + `packages/` 分层；共享逻辑进 `packages/*`。
- **Web 与 RN 共享 UI**：通过 `app-shared` + `design-system` 与 peerDependencies 对齐 React/RN 主版本（升级需注意双 React 实例风险——根 `README.md` 生产 checklist 已提示）。
- **Vite 直连源码**：`apps/web/vite.config.ts` 将 `@kb-rag/*` alias 到 `packages/.../src/index.ts`，属开发/构建约定。
- **Lint / Format**：仓库内未发现根级 `eslint` / `prettier` / `biome` 配置文件（**待确认**：是否依赖编辑器默认或未提交配置）。
- **测试**：根目录 **`pnpm test`** 链式执行 **`@kb-rag/api-core`**（当前脚本为占位 `node -e`）、**`@kb-rag/client-offline-core`**（Vitest：stubEmbed、localRetrieve、runLocalRagTurn 等相关单测）、**`@kb-rag/app-shared`**（Vitest：`effectiveOffline` 等）；**不要求 `ARK_API_KEY`**。E2E 仍见 **`pnpm test:e2e`** 与文档 smoke。

## 8. 基础设施

### Docker / Compose

- **多阶段 Dockerfile**：builder（pnpm install + build + prune）→ runner（`node apps/server/dist/main.js`），暴露 8788，复制 `apps/web/dist`。证据：根 `Dockerfile`。
- **Compose**：`docker-compose.yml` 单服务 `kb-rag`，端口映射、`.env` 注入、`kb_store` / `sessions` / `kb_uploads` 卷挂载、`GET /healthz` healthcheck。证据：`docker-compose.yml`、根 `README.md`。

### CI

- **未发现** 根目录下 `.github/workflows`（当前快照无 GitHub Actions 工作流文件）。**待确认**：是否在其他平台 CI 或未入库。

## 9. 安全与敏感面（索引级）

| 主题 | 位置 / 机制类型 |
|------|------------------|
| 环境变量与密钥 | 根 `.env.example`（未读取内容）；`apps/server/src/loadRootEnv.js`；Compose `env_file: .env`。 |
| 管理类上传 / 替换 | `HTTP_ADMIN_TOKEN` 等约定见根 `README.md`；服务端校验见 `apps/server/src/requireAdminBearer.ts` 及 KB 路由。 |
| CORS | `apps/server/src/corsConfig.ts`（`app.ts` 引用）。 |
| 限流 | `express-rate-limit`；开关与键策略见根 `README.md`「生产 checklist」。 |
| JSON / 上传大小 | `apps/server/src/jsonBodyLimit.ts`、`kbUploadLimits.ts` 等。 |
| 日志与 requestId | `pino` / `pino-http`、`apps/server/src/httpRequestLogger.ts`。 |
| 公开前端配置 | `apps/web/.env.local` 的 `VITE_HTTP_ADMIN_TOKEN`；Mobile 的 `EXPO_PUBLIC_*`（文档强调勿写入方舟密钥）。 |

## 10. 深入阅读索引

新贡献者建议优先阅读（≤10）：

1. `README.md` — 端到端使用方式、端口、Docker、E2E、安全清单。  
2. `docs/KB_API.md` — HTTP 契约。  
3. `docs/KB_OPERATIONS.md` — 运维与多轮裁剪等。  
4. `docs/PRODUCTION_SECURITY_V4.md` — 生产与 Compose 约定。  
5. `apps/server/src/app.ts` — 中间件顺序、静态 SPA 与 `/v1` 挂载。  
6. `apps/server/src/main.ts` — 进程启动、webDist、端口。  
7. `packages/api-core/src/index.ts` — 库对外 API 面。  
8. `apps/web/vite.config.ts` — 代理与 workspace alias。  
9. `docker-compose.yml` — 本地/演示编排。  
10. `pnpm-workspace.yaml` — 工作区边界。

---

**刷新建议**：框架大版本升级、目录重构、新增一整端（例如镜像内纳入 mobile）、或 CI 从无到有时，可重新跑「repository-atlas」流程并更新本文日期与差异一句。新需求对话可 `@repository-atlas` 并指向本文件以减少全仓盲扫。
