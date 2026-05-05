# 生产与安全（v3 阶段 P/Q/R + v4 阶段 X）

本文档继承实现指南 **v3** 的 **P（生产加固）、Q（Docker）、R（火山引擎云上）**，并汇总 **v4** 多端场景下的增补 checklist。实现细节以仓库代码与根目录 **`README.md`**「生产 checklist」为准。

---

## 1. 阶段 P：生产级加固（已实现项见 README 勾选）

| 能力 | 说明 | 环境变量 / 位置 |
|------|------|----------------|
| **速率限制** | `POST .../messages` 与流式路径；可按 IP，可选叠加 `sessionId` | `HTTP_RATE_LIMIT_*` |
| **JSON body 上限** | 与 multipart **KB 上传**上限独立 | `HTTP_JSON_BODY_MAX_BYTES` |
| **Multipart 上传上限** | 替换知识库 PDF | `KB_UPLOAD_MAX_BYTES` |
| **结构化日志** | `pino` + `pino-http`；`X-Request-Id` / `requestId`；勿打印完整 PDF 与完整 prompt | `LOG_LEVEL` |
| **方舟超时** | 对话与嵌入 HTTP 超时 | `ARK_REQUEST_TIMEOUT_MS` |
| **Readiness** | **`/healthz`** 轻量探活；**`/readyz`** 读 `kb_store/manifest`（不调方舟） | — |
| **管理鉴权** | 替换 KB：`Authorization: Bearer` 与 **`HTTP_ADMIN_TOKEN`** 一致 | `HTTP_ADMIN_TOKEN` |

未在仓库内自动化实现项（集中日志、WAF、mTLS 等）仍在 **`README.md`** 生产 checklist 中留空，由运维在网关侧补齐。

---

## 2. 阶段 Q：Docker（镜像、Compose、非 root）

- **多阶段构建**：根目录 **`Dockerfile`**：`pnpm install --frozen-lockfile` → 全量 **`pnpm run build`** → `pnpm prune --prod`；运行阶段 **`node:20-alpine`**，**`USER node`**。
- **端口**：镜像 **`EXPOSE 8788`**（与默认 **`PORT`** 一致）。
- **Compose**：**`docker-compose.yml`** 挂载 **`kb_store`**、**`sessions`**、**`kb_uploads`**；**`env_file: .env`**（密钥不进镜像，见 **`.dockerignore`**）。
- **健康检查**：compose 内 **`GET /healthz`**（`wget`）。

会话是否跨容器重启保留：取决于 **`ARK_SESSION_PERSIST`** 与 **`sessions` 卷**，见 **`README.md`**「容器重启后会话是否还在？」。

---

## 3. 阶段 R：火山引擎与公网入口（CLB / TLS / 上传大小）

以下为**架构约束与核对清单**（控制台菜单名以火山当前文档为准）。

### R1. 镜像与 Secret

1. 镜像推送到火山 **容器镜像服务（CR）**；计算选用 **VKE** 或 **ECS + 容器** 等。  
2. **`ARK_*`**、**`HTTP_ADMIN_TOKEN`**、**`PORT`** 等写入火山 **Secret / 环境注入**，**禁止**把含密钥的 `.env` **打进镜像**。  
3. 计算节点出口须能访问方舟 OpenAI 兼容域名。

### R2. CLB / Ingress 与 TLS

- **HTTPS**（TLS 1.2+）终止在 **CLB** 或 Ingress；后端 Pod 可为 HTTP。  
- **网关 body 上限**须 **≥ `KB_UPLOAD_MAX_BYTES`**，否则大 PDF 在上游被截断（表现为异常断开或非 413）。  
- **空闲超时**须大于长回答或 **SSE** 流式持续时间。

### R3. 持久化与副本数（单副本说明）

| 组件 | 单副本（MVP 推荐） | 多副本时注意 |
|------|-------------------|--------------|
| **`kb_store`** | 云盘 / NAS 挂载 | 需共享存储或单一写入者；ingest 与 chat 并发策略要明确 |
| **`sessions` 文件** | 与持久化开关配合挂载 | 应迁移 **Redis** 等外置存储 |
| **内存 SessionStore** | 仅当前进程 | 必须外置会话存储 |

**v3/v4 MVP 建议**：首版云上 **单副本 + 卷挂载**；扩容前完成会话与向量存储方案评审。

---

## 4. 阶段 X：v4 增补（多端与离线）

### 4.1 React / react-native-web / Expo 版本锁定

- **目标**：整个 workspace **仅一套 React**，避免 Web（Vite）与 Expo（Metro）各装一份 `react` 导致 hooks 异常或体积膨胀。  
- **约定**：  
  - **`apps/mobile`** 以 **Expo SDK** 为准锁定 **`react`** 与 **`react-native`**（当前 **`react-native` 0.76.7** 与 **`apps/web`** 对齐）。  
  - **`apps/web`** 使用 **`react-native-web`**；`vite.config.ts` 将 **`react-native`** 解析到 **`react-native-web`**（见 **`apps/web/README.md`**）。  
- **运维**：升级 Expo 主版本时，同步抬 **`apps/web`** 的 **`react-native`** / **`react`** 范围并 **`pnpm install`**，跑 **`pnpm -r run typecheck`** 与两端冒烟。

可选加固：在根 **`package.json`** 使用 **`pnpm.overrides`** 统一 **`react` / `react-dom`** 精确版本（需在升级后回归 lockfile）。

### 4.2 密钥与 CI/CD（方舟不进 App / 静态包）

- **`ARK_API_KEY`**：仅存在于**服务端运行环境**（裸金属、容器 Secret、托管平台环境变量），**永不**写入：  
  - Web **`import.meta.env` / Vite 注入**（除公开的 **`VITE_*`** 且不得含密钥）；  
  - Expo **`EXPO_PUBLIC_*`**；  
  - GitHub Actions / GitLab CI **明文变量打进前端构建**（除非使用仅限服务端的私密上下文）。  
- **EAS / 应用商店构建**：**`eas.json` profile** 的 env 仅允许 **`EXPO_PUBLIC_API_BASE_URL`**、短期 **`EXPO_PUBLIC_HTTP_ADMIN_TOKEN`**（若业务接受客户端持有上传口令——仍弱于网关鉴权）；**禁止** `ARK_*`。  
- **服务端**：方舟与 **`HTTP_ADMIN_TOKEN`** 仅在部署平台 **Secret** 中注入 **`kb-rag-server`** 进程。

### 4.3 离线模式与公网暴露

当 **`AI_RUNTIME_MODE=offline`**（或 **`RUNTIME_MODE=offline`**）并配置 **`LOCAL_CHAT_BASE_URL`**（本机 Ollama、llama.cpp HTTP 等）时：

> **勿将不具备 TLS、强认证与审计能力的本地推理服务直接暴露到公网。**  
> 离线栈通常缺少企业级加密、访问控制与日志留存；若必须远程访问，应通过 **VPN / 零信任隧道 / 私有链路**，或由具备审计能力的 API 网关反向代理。

详见根目录 **`.env.example`** 中离线变量段落的简短提示。

---

## 5. 文档索引

| 主题 | 路径 |
|------|------|
| HTTP 契约与健康检查 | **`docs/KB_API.md`** |
| 运维与 KB 操作 | **`docs/KB_OPERATIONS.md`** |
| Web Vite + RN Web 说明 | **`apps/web/README.md`** |
| Expo / EAS | **`apps/mobile/README.md`** |
| 环境变量模板 | **`.env.example`** |
