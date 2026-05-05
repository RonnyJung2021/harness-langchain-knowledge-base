# kb-rag-local

本地 PDF 知识库问答（ingest + ask RAG 流水线；依赖方舟 API）。

## 使用说明

1. 将 PDF 放入目录 `pdfs/`。  
2. 复制 `cp .env.example .env`，填写 `ARK_API_KEY` 等变量。  
3. 安装依赖：`pnpm install`（若报 `ERR_PNPM_IGNORED_BUILDS` 与 esbuild，在仓库根执行一次 **`pnpm approve-builds --all`** 后再 `pnpm install`）。  
4. 编译：`pnpm run build`  
5. 入库：`pnpm ingest -- pdfs/某文件.pdf`  
6. 提问（需已有 `kb_store/vectors.json`）：

```bash
pnpm ask -- "这份资料的核心结论是什么？"
```

### 示例问题

- 「请用三句话概括文档在讲什么。」  
- 「文中提到的关键步骤有哪些？」  
- 「针对某一段，作者的主要论点是什么？」  

### 常见问题

- **HTTP 429 / Too Many Requests**：方舟侧限流或配额紧张。请稍后再试、降低调用频率，或在控制台检查用量与套餐。  
- **PDF 入库后 chunk 很少或问答答非所问**：常见原因是 PDF **只有扫描图、没有可选中文字**（无文本层）。请换用带文字层的 PDF，或对扫描件做 OCR 后再入库。  
- **检索不到片段**：可调低环境变量 **`ARK_RAG_SCORE_MIN`**（默认 `0.35`），或改写问题；也可调大 **`ARK_RAG_TOP_K`**（默认 `4`）并配合更具体问题。

换书、清空向量、环境变量与安全边界等运维约定见 **`docs/KB_OPERATIONS.md`**。多轮对话的**历史条数与参考资料长度裁剪**（`ARK_CHAT_MAX_HISTORY_MESSAGES`、`ARK_RAG_CONTEXT_MAX_CHARS`）见该文档 **「6. 多轮与裁剪」**。

### 可视化网页（Vite + React，极简）

- **双进程开发**：终端 A 根目录执行 **`pnpm serve`**（默认 `8787`，需已有 `kb_store` 与根目录 `.env`）；终端 B 执行 **`pnpm dev:web`**，浏览器打开 **http://127.0.0.1:5173**（Vite 将 `/v1`、`/healthz`、`/readyz` 代理到 `127.0.0.1:8787`）。  
- **替换知识库**：页面使用 `POST /v1/knowledge-base/replace`，需在 **`web/.env.local`** 配置 **`VITE_HTTP_ADMIN_TOKEN`**，与根目录服务端 **`HTTP_ADMIN_TOKEN`** 一致；**勿将 `web/.env.local` 提交到 git**（已在 `.gitignore`）。生产环境请用短期票据、同源 Cookie 或网关鉴权，避免把长期 token 打进前端静态包。  
- **单进程生产**：先 **`pnpm run build && pnpm run build:web`**，再只跑 **`pnpm serve`**：Express 在挂载 `/v1` 后托管 **`web/dist`**，并对非 `/v1` 的 `GET` 回退到 **`index.html`**（静态资源与 API 不冲突）。

HTTP JSON 契约见 **`docs/KB_API.md`**。

### 临时修改端口（避免「address already in use」）

同一台机器上若 **`8787` 已被占用**（例如已运行 **`pnpm serve`**），可选用下列方式之一：

**Docker Compose（推荐与本机 dev 错开）**

- 默认映射为 **`8788:8787`**（宿主机 **8788** → 容器内仍监听 **8787**），浏览器打开 **http://127.0.0.1:8788**。  
- **临时一行命令**（不改文件）：  
  `KB_RAG_HOST_PORT=8790 docker compose up --build` → 访问 **http://127.0.0.1:8790**。  
- **在 `.env` 里统一改**（compose 会自动读仓库根 `.env` 做插值）：同时设定 **`KB_RAG_HOST_PORT`**（宿主机对外端口）与 **`PORT`**（容器内监听端口）。二者通常设为**同一个数字**即可，例如：  
  `KB_RAG_HOST_PORT=8790` 与 `PORT=8790` → 映射为 **8790:8790**，访问 **http://127.0.0.1:8790**。  
  若只想改宿主机端口、保持容器内仍为 8787：只设 **`KB_RAG_HOST_PORT=8790`**，勿改 **`PORT`**。

**本机 `pnpm serve` / Vite 双进程**

- API：**`PORT=8790 pnpm serve`**  
- 前端代理：终端 B 执行 **`VITE_API_PORT=8790 pnpm dev:web`**（与 **`web/vite.config.ts`** 中默认代理一致）。

**本机单进程（`pnpm serve` 已托管 `web/dist`）**

- **`PORT=8790 pnpm serve`**，浏览器 **http://127.0.0.1:8790**。

### Docker（阶段 Q，开发 / 演示）

1. 复制 **`cp .env.example .env`** 并填写方舟相关变量；**不要将含密钥的 `.env` 打进镜像**（已在 `.dockerignore` 忽略）。  
2. **`./kb_store` 中须有已 ingest 的向量**（`vectors.json` / `manifest.json`），否则进程启动时会报错；可将本机已有 `kb_store` 挂入容器，或先在宿主机执行 `pnpm ingest` 再启动 compose。  
3. 启动：**`docker compose up --build`**，浏览器访问 **http://127.0.0.1:8788**（默认映射 **`8788:8787`**，静态页 + 同源 **`/v1`**）。可通过 **`KB_RAG_HOST_PORT`** / **`PORT`** 调整，见上文「临时修改端口」。Compose 通过 **`env_file: .env`** 向容器注入环境变量。  
4. **数据卷**：`./kb_store` → `/app/kb_store`、`./sessions` → `/app/sessions`、`./kb_uploads` → `/app/kb_uploads`（上传替换 PDF 时写入）。  
5. **运行身份**：镜像最终阶段为 **`node:20-alpine`**，主进程以 **`USER node`**（非 root）执行 **`node dist/server/main.js`**。  
6. **健康检查**：compose 内对 **`GET /healthz`** 配置了 **`healthcheck`**（镜像内使用 `wget`）。

**容器重启后会话是否还在？**

- **未设置 `ARK_SESSION_PERSIST=1`**：会话只在**当前进程内存**中；**重启即丢失**，与是否挂载 `sessions` 目录无关。  
- **`ARK_SESSION_PERSIST=1`**：新消息会写入 **`sessions/{sessionId}.json`**。此时是否跨重启保留，取决于是否挂载 **`./sessions:/app/sessions`**：  
  - **已挂载**：文件写在宿主机目录上，**重启容器后会话文件仍在**（同一 `sessionId` 可继续用）。  
  - **未挂载**：数据写在容器可写层，**重建或删除容器后通常丢失**；不建议依赖未挂载的落盘路径。

### 生产 checklist（阶段 P）

上线前逐项核对；已实现项已勾选，其余留空待网关 / 运维补齐。

- [x] **速率限制**：`express-rate-limit` 作用于 `POST .../messages` 与 `POST .../messages:stream`；`HTTP_RATE_LIMIT_ENABLED=1` 时生效，键为客户端 IP，可选 `HTTP_RATE_LIMIT_BY_SESSION=1` 叠加 `sessionId`；超限返回 **429**、`error.code: RATE_LIMITED`。
- [x] **JSON body 上限**：`express.json` 使用 `HTTP_JSON_BODY_MAX_BYTES`（默认 256 KiB），与 **`KB_UPLOAD_MAX_BYTES`**（multipart）独立；超限 **413**、`PAYLOAD_TOO_LARGE`。
- [x] **结构化日志**：`pino` + `pino-http`；响应头 **`X-Request-Id`**（或请求传入的 `x-request-id`），错误 JSON 含 **`requestId`** 便于与日志关联。请勿在业务中 `console.log` 完整 PDF 或完整 prompt；密钥类头在日志配置中 redact。
- [x] **方舟超时**：`ARK_REQUEST_TIMEOUT_MS`（默认 120s）作用于对话与嵌入；超时映射 **504**、`ARK_TIMEOUT`（流式 SSE 的 `error` 帧同码）。
- [x] **Readiness**：**`GET /readyz`** 尝试读取 `kb_store/manifest.json`（不调用方舟）；**`GET /healthz`** 仍为轻量进程探活。二者区别见 **`docs/KB_API.md`**。
- [ ] **集中日志 / 脱敏审计**：将 pino 输出接入 ELK / Loki 等；审计字段与保留周期按合规要求由运维配置。
- [ ] **WAF / Bot 防护**、**mTLS / 私有链路**：由入口网关或云厂商完成，本仓库仅文档约定。

### 前端验证与 E2E（O2）

- **页面内**：顶部横幅展示最近一次成功/失败；对话区、上传区有 **loading / 禁用 / 内联成功条**；折叠面板 **「连接自检」** 可顺序探测 `GET /healthz`、`GET /readyz`、`POST /v1/sessions`、`GET /v1/sessions/:id`；可选勾选 **「包含一条模型调用」** 会 `POST .../messages`（消耗方舟配额）。错误文案会区分 **401 / 413 / 429 / 504 / 5xx** 等，并隐藏可能的 **Bearer** 片段。  
- **Playwright**：根目录执行 **`pnpm test:e2e:install`**（首次安装 Chromium），再 **`pnpm test:e2e`**。默认会拉起 **`pnpm serve`**（端口 **`E2E_API_PORT`，默认 `18790`，避免与开发常用 8787 冲突）与 **`pnpm dev:web`**（5173，经 `VITE_API_PORT` 代理到同一 API 端口）；若本机已在跑对应服务，会复用（`reuseExistingServer`）。  
- **跳过条件**：未配置 **`ARK_API_KEY`** 时套件内用例会 **skip**（不失败）；或设置 **`E2E_SKIP=1`** 跳过（**不启动** webServer，适合 CI 无浏览器/无密钥）。CI 无密钥时可设 `E2E_SKIP=1`。**MSW mock** 未接入；若需无密钥跑通 UI，可自行加 mock 或扩展用例。

### 多轮对话与会话落盘（可选）

- **默认**：`pnpm chat` 仅在**内存**中保留当前进程内的消息，退出后不留痕。  
- **落盘**：在 `.env` 中设置 **`ARK_SESSION_PERSIST=1`** 后，每次追加用户/助手消息会写入仓库根目录 **`sessions/{sessionId}.json`**（UTF-8 JSON，含 `id`、`createdAt`、`updatedAt`、`messages`）。**请勿将含敏感提问或业务机密的快照提交到 git**；`sessions/*.json` 已在 `.gitignore` 中忽略，仅保留 `sessions/.gitkeep`。  
- **恢复**：`pnpm chat -- --resume <sessionId>`，其中 `sessionId` 须为合法 **UUID**（与文件名一致）；实现会校验格式并防止路径穿越。未开启 `ARK_SESSION_PERSIST` 时仍可**只读**从已有 JSON 恢复上下文，但后续对话不会自动写回磁盘，除非再开启落盘。

## 验收

对应实现指南 **C2**：`package.json` 中已提供脚本 **`ingest:smoke`**。行为如下：

1. **最小 PDF**：若仓库中尚无 `pdfs/_smoke.pdf`，则调用 `scripts/gen-smoke-pdf.py` 生成（**优先几十字中文**；若本机找不到常见 CJK 字体则退化为英文长句，仍可用于管道验收）。需本机 **Python 3** 与 **reportlab**（`pip install reportlab`）。  
2. **跑入库**：等价于对 `pdfs/_smoke.pdf` 执行 `pnpm ingest -- pdfs/_smoke.pdf`（需已配置 `.env` 且方舟 API 可用）。  
3. **Harness 断言**：命令**末尾**打印 `kb_store` 下 `vectors.json`、`manifest.json` 的**文件大小**，并断言 **`chunk > 0`**（否则进程以非零码退出）。

```bash
pnpm ingest:smoke
```

默认 **`ARK_EMBED_INPUT_MODE=multimodal`（可省略）**：面向方舟「多模态向量化」端点，请求 **`POST {ARK_BASE_URL}/embeddings/multimodal`**，`input` 为内容片段数组；纯文本块使用 `[{ "type": "text", "text": "..." }]`。`ARK_EMBED_DIMENSIONS` 须与控制台（1024 / 2048）一致。若接入点为**纯文本** OpenAI 兼容 `.../embeddings`，设置 **`ARK_EMBED_INPUT_MODE=text`**。
