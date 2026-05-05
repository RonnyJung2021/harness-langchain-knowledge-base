# 实现指南 v4：多端（Web + React Native）+ 响应式同源 + 在线/离线模式预留（Harness + Cursor Agent）

> **读者**：已完成 v1～v3（或具备等价能力：PDF RAG、`runRagChatTurn`、Express API、极简 React 网页），希望用**同一套 React 组件思路**覆盖 **手机浏览器、桌面浏览器、Android、iOS**，并与 **React Native Web + 统一设计系统**对齐；**手机与桌面共用同一 URL**，不做独立 m 站域名分流；同时为 **在线（火山引擎方舟）** 与 **离线（本地闭环替换方舟）** 预留清晰编码边界。  
> **Harness 对齐**：**任务契约**（多端共用同一业务类型与 API 形状）、**工具治理**（云端能力仅通过可替换 Provider 注入）、**状态管理**（会话与 KB 策略在线/离线一致）、**安全边界**（密钥永不进静态包与 RN bundle）、**验证机制**（各端冒烟 + 模式切换自检）。  
> **模式原则（本版锁定）**：  
> - **在线模式**：**仅**大模型与向量等「方舟类能力」走 **火山引擎方舟**（OpenAI 兼容接入）；**检索、会话存储、PDF 解析、向量库存储、业务 API** 等均在**本地或可自建进程内**闭环，**不引入**其它公有云 SaaS（对象存储/托管数据库/第三方 Auth 云等——若必须文档化例外并默认关闭）。  
> - **离线模式**：用户在本地用**另一套实现**替换方舟（本地小模型、本地嵌入、或降级嵌入+关键词检索等），**效果可差**，但 **UI 流程与 API 契约尽量与在线一致**（同一功能面：入库、多轮、引用、替换 KB、错误反馈）。  
> **技术定案（v4 锁定）**：**pnpm workspace 单体仓库**；**packages/app-shared**（业务组件 + 调用适配层）+ **packages/design-system**（Design Tokens + 跨平台 primitive）；**apps/web**（Vite + React + **react-native-web**，与 v3 同源托管策略兼容）；**apps/mobile**（**Expo + React Native**，Hermes）；服务端仍为 **Node + Express**（与 v3 一致，负责鉴权、ingest、向量存储与 **在线模式下**对方舟的调用）。  

---

## 0. v4 与 v3 的差异（读 3 分钟）

| 维度 | v3 | v4 |
|------|----|----|
| 前端形态 | 单一 `web/`（Vite React） | **Web + Native** 双应用；**共享** UI 与交互逻辑（经 RN 原语 + react-native-web） |
| URL / 入口 | 浏览器同源 SPA | **浏览器**仍为 **同一 SPA URL**（响应式）；**无** `m.example.com` 分流；App 内嵌 WebView 可选但 **非默认主路径** |
| 设计 | 页面内联样式或轻量 CSS | **统一设计系统**（tokens、间距、字体刻度、暗色等跨平台一致） |
| 模型与嵌入 | 服务端直接调方舟 | **抽象 Provider**；在线接方舟；离线换本地实现（可进程内或侧车进程） |
| 验收 | Web E2E 为主 | Web + **Android/iOS 构建冒烟** + 模式切换自检（文档约定 CI 矩阵） |

**设计硬约束（继承 v3 并追加）**：

- HTTP handler 仍保持 **薄**：解析 → 校验 → 调核心 → JSON；**禁止**把 `req`/`res` 渗入 `runRagChatTurn`。  
- **ARK_API_KEY** 仅存在于 **服务端环境变量**；Web/RN **永不**打包密钥。  
- **同一链接**：服务端 **`/`** 始终返回同一 SPA；靠 **CSS 响应式 + 触控命中区域** 适配手机与桌面，不靠 UA 重定向到另一站点。  

---

## 1. 打开 Cursor Agent 的标准姿势（与 v1～v3 相同）

1. **`⌘ + L`**（Windows/Linux：**`Ctrl + L`**）打开 Chat，切到 **Agent**。  
2. **完整粘贴**本指南对应步骤「**Agent 输入框粘贴**」区块。  
3. 批准终端/网络/写文件。  
4. 失败时：新开一条消息，首行「上一步失败」，粘贴**完整**终端报错与平台（Web / iOS / Android）、以及当前 **RUNTIME_MODE**（online/offline）。

---

## 2. 阶段 S：workspace 骨架与设计系统包（任务表达 + 熵管理）

### S1. pnpm workspace 与目录契约

**目的**：把「可共享 UI」与「各端入口」分离，避免三套拷贝漂移。

**Harness 对齐**：**上下文组织**（共享模块单一真相）；**验证**（各 package 可独立 `typecheck`）。

**Agent 输入框粘贴**：

```text
将本仓库升级为 pnpm workspace（若已是 monorepo 则对齐以下结构，尽量少改名）：

根 package.json：
  - "private": true
  - "workspaces": ["apps/*", "packages/*"]
  - scripts：保留原有 build/serve/ingest/chat；新增 build:web / dev:web 若需迁移到 apps/web

目录目标：
  apps/web          —— Vite + React + react-native-web（由现有 web/ 迁入或保留 web 为 apps/web 别名，二选一写 README）
  apps/mobile       —— Expo（TypeScript），依赖 packages/*
  packages/design-system —— tokens（colors/spacing/radius/typography）、ThemeProvider、跨平台 Text/Pressable/Box 等 primitive（基于 react-native 组件，web 侧由 react-native-web 承接）
  packages/app-shared    —— 业务面板：ChatPanel、KbReplacePanel、DiagnosticsPanel、hooks（useSessionApi、useKbReplace）；仅依赖 design-system + 共享类型；禁止 import react-dom 专有 API

约束：
  - app-shared 内禁止直接 fetch 方舟；所有 AI 能力请求仍走同源 /v1（Web）或通过文档约定的 Native Base URL（环境变量 EXPO_PUBLIC_API_BASE_URL，仅域名不含密钥）
  - 将原 web/src 内组件逐步迁至 app-shared，apps/web 只做入口、路由（若有）、与 RN 兼容的 SafeArea/Portal 适配

验收：根目录 pnpm install；pnpm -r exec tsc --noEmit 或各包 build 脚本通过（按你配置的脚本为准）。
```

**验收标准**：

- `packages/design-system` 与 `packages/app-shared` 可被 **web 与 mobile** 同时引用且无循环依赖。  
- 根目录一条命令能安装全部 workspace 依赖。

**Harness 对齐**：**熵管理**（组件单一来源）。

### S2. 统一设计系统（tokens + primitives）

**目的**：手机浏览器 / 桌面浏览器 / RN **视觉与间距一致**；后续暗色与无障碍一次改全局。

**Agent 输入框粘贴**：

```text
在 packages/design-system 实现最小统一设计系统：

1) tokens.ts：导出语义色、neutral 阶梯、spacing（4px 网格）、radius、fontSize 阶梯（考虑移动端最小字号≥14px 可读）
2) ThemeProvider：支持 light/dark（可先 stub dark），用 React Context 注入 tokens
3) primitives：Box（View）、Text、Pressable、TextInput、ScrollView、ActivityIndicator 等——全部从 react-native 引入，勿用 div/button 写在 shared 包（apps/web 配置 react-native-web alias）
4) 文档 packages/design-system/README.md（中文简短）：Web 需在 Vite resolve.alias 指向 react-native-web

验收：在 apps/web 与 apps/mobile 各放一个「DesignSystemSmoke」屏，展示 tokens 样例与按钮按下反馈；两截图视觉节奏一致（允许字体差异由平台渲染造成）。
```

**验收标准**：

- 业务组件 **只引用** `packages/design-system` 的 primitive，不直接写裸 `className` 散落在 shared（web 特有布局可在 apps/web 薄封装一层）。

**Harness 对齐**：**任务契约**（跨平台组件 API 稳定）。

---

## 3. 阶段 T：Web 响应式同源（不区分 m 站）

### T1. Vite + react-native-web + 响应式布局

**目的**：**同一 URL** 服务手机与桌面；布局随断点变化；触控友好。

**Harness 对齐**：**安全边界**（不新增域名攻击面）；**验证**（常用断点下关键按钮可点）。

**Agent 输入框粘贴**：

```text
在 apps/web（或迁移后的 web）配置：

1) 依赖 react-native-web、react-native（版本与 Expo 对齐，避免双实例）
2) Vite alias：react-native -> react-native-web（按官方推荐方式）；处理可选的 metro-less 限制（若遇问题用文档记录 workaround）
3) 根布局使用 flex + maxWidth（例如桌面居中 max-width 720～960px；手机全宽）；聊天列表与输入区遵循底部安全区（web 用 env(safe-area-inset-bottom) + padding）
4) 禁止根据 UA 做 window.location 跳转到另一主机；允许仅在站内路由切换
5) meta viewport 正确；按钮 minHeight≥44px（触控）

app-shared 内若有「侧边栏」：小屏改为底部 Tab 或抽屉（同一组件 props 切换 layout variant）

验收：Chrome DevTools 设备模拟 iPhone + 桌面宽度同一 URL 均可完成：新会话、发送消息、上传 PDF（若 v3 已有）；无横向滚动溢出（允许横向 citations 内部滚动）。
```

**验收标准**：

- **无** `m.` 子域配置；nginx/CLB 仅一条 server_name。  
- Lighthouse 或人工确认：首屏关键操作不被遮挡。

**Harness 对齐**：**反馈回路**（小屏仍可见错误提示与 loading）。

### T2. 与 v3 Express 同源托管对齐

**目的**：生产仍 **单 origin**，简化 Cookie/鉴权与 CORS。

**Agent 输入框粘贴**：

```text
确保 apps/web build 产物仍由 Express express.static 托管，顺序与 v3 一致：先 /v1 API，再静态，再 SPA fallback；路径改为 apps/web/dist 若迁移

README 写明：Web 与 API 同源；移动端浏览器访问与桌面同一域名。
```

---

## 4. 阶段 U：React Native（Android / iOS）

### U1. Expo 工程与共享业务接入

**目的**：同一 `packages/app-shared` 在原生壳运行；API 仍指向用户可配置 Base URL（局域网或 HTTPS 域名）。

**Harness 对齐**：**工具治理**（Native 不嵌入密钥）；**验证**（真机或模拟器冒烟）。

**Agent 输入框粘贴**：

```text
新建 apps/mobile（Expo Router 可选）：

1) 依赖 packages/app-shared、packages/design-system；配置相同 babel/typescript paths
2) 环境变量：EXPO_PUBLIC_API_BASE_URL（例如 https://your-domain 或 http://10.0.2.2:8787 安卓模拟器）；**禁止** EXPO_PUBLIC_* 放方舟 key
3) app-shared 内 fetch 客户端：默认 relative URL 在 web；Native 用 Config.API_BASE_URL 前缀拼接（抽象 tiny apiClient）
4) 文件上传：RN 使用 FormData + multipart；处理 Android/iOS 权限与 URI（expo-document-picker 或等价）
5) 构建说明：eas.json 或本地 expo run:android / run:ios（文档中文）

验收：模拟器上完成一轮会话 +（若 API 可用）上传小 PDF；离线 API 时至少验证 UI 错误提示与 Diagnostics 面板（阶段 W）可展示网络失败。
```

**验收标准**：

- Android 与 iOS **至少一端**在 CI 或文档中可复现构建；关键屏无红屏。  

**Harness 对齐**：**错误分类**（网络、401、413 等在 Native 与 Web 文案一致）。

### U2. （可选）Universal Links / App Links

**目的**：分享同一 HTTPS 链接时，已安装 App 可唤起（非 v4 必须）。

**Agent 输入框粘贴**（可选）：

```text
若需要：为同一域名配置 iOS Universal Links 与 Android App Links；路径仍指向 Web SPA，App 仅接管特定 path。文档说明与服务器 apple-app-site-association / assetlinks 放置位置。
```

---

## 5. 阶段 V：在线 / 离线模式架构预留（工具边界 + 可替换 Provider）

> **核心**：把「会碰方舟的一切」收敛到 **服务端**（推荐）或 **明确标注的单独适配层**，通过 **接口 + 工厂** 切换实现；**禁止**在 UI 层散落 `if (offline)` 调不同 SDK。

### V1. 定义 AiRuntimeMode 与 Provider 接口

**目的**：在线只走方舟；离线走本地实现；两者对外暴露 **相同的 TypeScript 类型**（输入输出与 v2/v3 对齐）。

**Harness 对齐**：**任务表达**；**工具治理**（可测试、可 mock）。

**Agent 输入框粘贴**：

```text
在服务端 src/ai/（路径可调整）新增：

1) 枚举 AiRuntimeMode：online | offline（读取 env AI_RUNTIME_MODE，默认 online）
2) 接口 ArkLikeChat：chat(messages) -> assistant text（或 async iterator 若已有流式）
3) 接口 ArkLikeEmbeddings：embedDocuments(texts)、embedQuery(text)
4) 工厂 createAiDeps(mode): { chat, embeddings }
   - online：沿用现有 @langchain/openai + 方舟 baseURL/apiKey（仅从 env）
   - offline：实现 LocalChat、LocalEmbeddings（初版允许）：
       - LocalEmbeddings 可用轻量本地模型（如 Transformers.js / onnxruntime / 侧车进程）或降级为「哈希+bm25」伪向量并在 README 标明效果差
       - LocalChat 可用本地 llama.cpp HTTP、ollama、或规则占位（必须有明确报错提示「离线模型未启动」）
5) runRagChatTurn 与 ingest 嵌入路径 **仅依赖** createAiDeps 返回值，不直接 new OpenAIEmbeddings()
6) .env.example 中文说明：AI_RUNTIME_MODE、离线所需 LOCAL_* 变量（端口、模型路径等）
7) /healthz 保持不调用方舟；新增可选 GET /v1/runtime-info 返回 { mode, capabilities: { chat:boolean, embeddings:boolean } }（勿泄漏密钥）

验收：AI_RUNTIME_MODE=online 行为与 v3 一致；切换 offline 且本地 stub 可用时 ingest 与 chat 可走通降级路径；offline 依赖缺失时返回清晰 503 + code。
```

**验收标准**：

- **在线**：仍仅消耗方舟，无额外云 SDK。  
- **离线**：无方舟密钥亦可启动进程（若本地引擎未配置则明确失败）；日志不打印密钥。  

**Harness 对齐**：**验证机制**（`/v1/runtime-info` 或等价自检）。

### V2. 离线能力对标清单（产品向）

**目的**：离线「可以差」，但 **流程齐全**。

建议在 `docs/OFFLINE_PARITY.md`（中文）维护表格：

| 能力 | 在线 | 离线目标 | 备注 |
|------|------|----------|------|
| PDF 入库 | 方舟嵌入 | 本地嵌入或 BM25 | chunk 策略一致 |
| 多轮对话 | 方舟 chat | 本地 chat | 上下文长度可更小 |
| 引用 citations | 有 | 有 | 离线可仅段落 ID |
| 替换 KB | 与 v3 同 | 同 | 互斥锁保留 |
| 流式输出（若有） | SSE | 可选关闭或本地流 | v4 可选 |

**Harness 对齐**：**反馈回路**（前端展示 `degraded: true` 当离线降级）。

---

## 6. 阶段 W：多端诊断与验收 UI（验证机制）

### W1. DiagnosticsPanel（Web + Native 共用）

**目的**：用户与运维快速区分 **网络 / 鉴权 / 模式 / 本地引擎** 问题。

**Agent 输入框粘贴**：

```text
在 packages/app-shared 增加 DiagnosticsPanel：
  - 顺序请求 GET /healthz → GET /v1/runtime-info（若存在）→ POST /v1/sessions → 可选短消息
  - 展示每步耗时、HTTP 状态、错误 code；Native 显示当前 API_BASE_URL（脱敏路径）
  - Web 与 Native 同一组件

验收：飞行模式或错误 Base URL 下仍有可读失败原因。
```

### W2. 测试矩阵（文档化）

**目的**：Harness **可重复验证**。

在根 README 或 `docs/E2E_MATRIX.md` 写明：

- Web：Playwright（可选保留 v3）  
- Android：`maestro` 或 Detox（可选）最小脚本  
- iOS：同上（可选）  
- 契约测试：对 `/v1` 跑 supertest（与 UI 解耦）

---

## 7. 阶段 X：生产与安全继承 v3 + v4 增补

**Agent 输入框粘贴**：

```text
继承 v3 阶段 P/Q/R（限流、日志、Docker、火山 CLB、上传大小、单副本说明）。

v4 增补 checklist：
  - react-native-web 与 Expo 版本锁定，避免重复 react
  - App 发布流水线不注入方舟 key；服务端 Secret 仍只在部署环境
  - 离线模式打开时：文档提示「勿将不具备加密与审计能力的本地服务暴露公网」
```

---

## 8. v4 总验收清单（交付前打勾）

- [ ] **Workspace**：`packages/design-system`、`packages/app-shared`、`apps/web`、`apps/mobile` 边界清晰，可独立 typecheck。  
- [ ] **同源响应式**：手机与桌面浏览器 **同一 URL** 完成核心流程；无 m 站分流。  
- [ ] **原生**：Android 与 iOS 至少一遍 **会话 + 上传** 冒烟（API 可用前提下）。  
- [ ] **模式**：`AI_RUNTIME_MODE=online` 默认等价 v3；`offline` 可启动且 **接口形状一致**，失败时错误可读。  
- [ ] **密钥**：任意平台静态产物中 **无** `ARK_API_KEY`。  
- [ ] **方舟边界**：除方舟外 **无**额外公有云依赖（若例外需在 README 显性列出）。  
- [ ] **诊断**：DiagnosticsPanel 在 Web / Native 均可运行。  

---

## 9. Harness 自检表（v4 增补）

| 要素 | v4 检查项 |
|------|-----------|
| 任务表达 | Web/RN 是否共用同一 API 类型（httpShape / OpenAPI）？ |
| 上下文组织 | 离线模式下 prompt 与 chunks 是否仍经同一裁剪逻辑？ |
| 工具治理 | 方舟调用是否只在 Provider 实现文件中出现？ |
| 状态管理 | 会话存储策略是否不因平台变化而分裂（仍 sessionId + 服务端 store）？ |
| 反馈回路 | `degraded`、`runtime-info`、错误 `code` 是否到达所有端？ |
| 安全边界 | Native 是否仅持有 Base URL？上传是否仍服务端鉴权？ |
| 验证机制 | 各端是否有最小冒烟与模式切换自检？ |

---

## 10. 文档版本与依赖

- **前置**：`implement guide/langchain-pdf-kb-rag-cursor-harness.md`（v1）、v2、`implement guide/langchain-pdf-kb-rag-cursor-harness-v3.md`（v3）。  
- **本文档**：v4，面向 **React Native Web + 统一设计系统 + Expo + 在线/离线 Provider**。  
- **执行顺序建议**：S1 → S2 → V1（可与 S 并行设计接口）→ T1 → T2 → U1 → W1 → X；可选 U2、V2 文档、W2。  

---

## 11. 常见陷阱（给 Agent 与人的备忘）

- **双 React / 双 react-native 实例**：统一 workspace 版本与 hoist 策略，遇到 Metro/Vite 冲突时优先查官方 expo + vite 混用说明。  
- **textarea**：shared 层用 `TextInput` multiline，勿在 shared 写 `<textarea>`。  
- **文件路径**：Native URI 与 Node fs 不同；上传必须 `FormData`，服务器逻辑保持在 v3 已验证路径。  
- **离线「功能均有」**：优先保证 **契约一致** 与 **错误可行动**，而非与 670B 云端模型质量对齐。  
