---
doc_type: requirement-atlas-analyzer
generated_at: "2026-05-05"
requirement_slug: "offline-mode-cross-platform"
related_paths_glob: "packages/api-core/src/ai/**, packages/api-core/src/chat/**, apps/server/src/**, packages/app-shared/**, apps/web/**, apps/mobile/**"
staleness_note: "Snapshot; repo may diverge during implementation."
confidence: "mixed"
---

> **文档性质与局限**  
> 1. 本文档**仅供实现阶段参考**，不是权威需求规格；**未**保证覆盖需求全部细节，后续仍可能补充或修正需求。  
> 2. 文中的关联与影响关系基于**生成时刻**的仓库与描述整理，**知识 / 相关性图谱可能不全面**；已写内容力求有据，但**可能准确却不完整**。  
> 3. 在逐步实现过程中，仓库会持续变化，**本文档可能逐步与真实代码不一致**；使用时应**谨慎对照**当前仓库，以代码与测试为准，必要时回到本文件仅作「当时如何理解关系」的线索。  
> **存放路径**：按你的约定放在 `project-atlas/`（技能默认路径为 `docs/requirements/<slug>-requirement-atlas.md`）。

# 需求图谱：全端离线可用 + 应用内「主动离线」开关

## 1. 需求摘要（引用级）

- **用户原意（概括）**：在 **Web、Android、iOS** 上，**断网**时仍可使用核心能力（效果可差，但能力要齐）；并在应用内通过**勾选**等方式，**主动**进入/控制离线模式（与「仅被动断网」区分或叠加——见待确认）。
- **成功判据（可检验方向）**：三端在目标离线场景下均能完成与线上一致或降级后的**主路径**（例如：会话、基于已加载知识库的问答、必要的自检/提示）；用户切换开关后行为可预期且可回退；不因断网导致白屏或无限挂起（需有明确降级 UI/错误码）。

## 2. 涉及范围总览

| 路径或模块 | 与需求关系 | 证据（函数 / 路由 / 关键符号） |
|------------|------------|-------------------------------|
| `packages/api-core/src/ai/mode.ts` | **读/配置语义**：进程级 `AI_RUNTIME_MODE` / `RUNTIME_MODE` | `parseAiRuntimeMode` |
| `packages/api-core/src/ai/factory.ts` | **读/写行为**：online 方舟 vs offline 桩嵌入 + 本地/占位对话 | `createAiDeps`、`OfflineStubEmbeddingProvider`、`HttpLocalChatProvider` |
| `packages/api-core/src/ai/runtimeInfo.ts` | **读**：对外能力描述（无密钥） | `computeAiRuntimeInfo` |
| `packages/api-core/src/chat/loadKbRagContext.ts` | **读**：按 mode 加载向量库与嵌入后端 | `loadKbRagContext` |
| `packages/api-core/src/ragDeps.ts` | **读**：RAG 依赖与 mode 绑定 | `createRagDeps`（与 env 解析） |
| `apps/server/src/main.ts` | **读**：启动时单次解析 mode 并构造 `ragTurnDeps` | `parseAiRuntimeMode`、`loadKbRagContext`、`createRagDeps` |
| `apps/server/src/app.ts` | **读**：暴露运行时给客户端 | `GET /v1/runtime`、`GET /v1/runtime-info` |
| `apps/server/src/chatServerContext.ts` | **读**：`runtimeMode`、`runtimeInfo` 注入路由层 | `ChatServerContext` 类型 |
| `packages/app-shared/src/panels/DiagnosticsPanel.tsx` | **读/可扩展**：已探测 `runtime-info`、网络类错误文案 | `GET /v1/runtime-info`、offline 相关正则 |
| `packages/shared/src/runtime.ts` | **读/类型**：`RuntimeMode` 字面量 | `RUNTIME_MODE`、`parseRuntimeMode` |
| `apps/web`（Vite、`registerSw.ts`） | **读/潜在写**：当前 SW **不**缓存 `/v1`（README 已述） | 与「纯浏览器断网仍调 API」冲突时的改造面 |
| `apps/mobile/App.tsx` | **读/潜在写**：`EXPO_PUBLIC_API_BASE_URL` 等 | 与「无后端时的本地栈」关系 |
| `docs/KB_API.md`、根 `README.md` | **读**：契约与离线环境变量说明 | 与新增「客户端开关 / 每请求模式」的文档同步 |

## 3. 当前行为（As-Is）

**主路径**

- **运行时模式是服务端进程级配置**：`apps/server/src/main.ts` 在启动时调用 `parseAiRuntimeMode(process.env)`，再 `loadKbRagContext(runtimeMode)`；`ChatServerContext` 持有单一的 `runtimeMode` 与 `runtimeInfo`（`apps/server/src/chatServerContext.ts`）。
- **offline 语义在 api-core**：`createAiDeps` 在 `offline` 下使用确定性桩向量与可选的 `LOCAL_CHAT_BASE_URL` 等（`packages/api-core/src/ai/factory.ts`）；`computeAiRuntimeInfo` 描述能力位（`packages/api-core/src/ai/runtimeInfo.ts`）。
- **三端客户端均通过 HTTP 访问同一套 `/v1`**：`packages/shared` 提供路径拼接；`app-shared` 内诊断面板会请求 `/v1/runtime-info`（`DiagnosticsPanel.tsx`）。

**分支逻辑**

- 客户端若无法连接 **API 基址**（含本机 `127.0.0.1` / `10.0.2.2` 等），现有功能依赖 `fetch` 失败路径；诊断里已有部分网络错误归类（同文件）。
- **无**「应用内勾选 → 改变服务端 AI 模式」的 API：**模式不可在请求级切换**，除非改进程环境并重启（运维向）。

**边界（有代码依据）**

- 根 `README` 已说明：`AI_RUNTIME_MODE=offline` 时检索质量弱、`LOCAL_CHAT_*` 不可用时的错误形态等；与「设备完全断网」不是同一命题——后者在仍依赖 HTTP 时**无法**仅靠该环境变量解决。

## 4. 目标行为（To-Be）

### 已明确（来自你的描述）

- **三端**在「离线场景」下仍具备**可用的**核心流程（允许效果差）。
- **应用内勾选**可**主动**控制是否走离线策略（与被动断网的关系：**待确认**——见第 8 节）。

### 推断（需在方案阶段二选一或多选组合）

- **推断 A（弱网 / 无公网，但可访问本机/局域网 API）**：服务端已支持 `offline` 模式；产品目标可能是「客户端提示 + 自动降级请求」或「用户勾选后服务端切换为 offline 管道」。后者当前缺**每请求/每租户**切换，需服务端与会话层设计增量。
- **推断 B（设备完全断网，含无法访问任何 HTTP 服务端）**：必须在 **Web / iOS / Android 各自运行时**内具备**不依赖当前 Express 进程**的执行路径（例如：内嵌轻量运行时、WASM 向量检索 + 本地生成、或预同步的只读问答数据）。**当前仓库无此路径**，属于大增量，与现有「浏览器 SPA + RN 壳 + Node 服务端」分界清晰。

## 5. 主功能逻辑变动（实现完成后预期会动到的「主路径」）

**主路径 → 若走「服务端仍可达 + 扩展开关」**

1. **配置与状态**：除进程启动参数外，引入「用户/会话/全局」层离线偏好（持久化位置：Web `localStorage` / RN `AsyncStorage` 等——**待确认**）。
2. **API 契约**：要么（i）新增 `PATCH`/`POST` 类「偏好」接口且服务端在 `runRagChatTurn` 路径上按偏好选择推理后端；要么（ii）仅客户端 UI 开关，实际仍依赖服务端 `AI_RUNTIME_MODE`（则**无法满足**「断网仍连服务端」矛盾，除非限定场景为推断 A）。
3. **`app-shared`**：设置面板或现有诊断区扩展「主动离线」勾选；与 `GET /v1/runtime-info` 展示对齐，避免 UI 与真实能力不一致。
4. **文档**：`docs/KB_API.md`、根 `README` 增补「客户端开关与服务端模式」矩阵与安全说明（**不写**密钥进前端包）。

**主路径 → 若走「真·设备本地执行」**

1. **`@kb-rag/api-core` 能力拆分**：将「仅依赖 Node 的 PDF/嵌入/向量检索」与「仅依赖浏览器/RN 可运行的子集」边界划清；可能需新包（如 `api-core-browser`）或条件导出，避免把 `pdfjs`/方舟 SDK 误打进不支持的运行时。
2. **数据面**：`kb_store`（或等价结构）在端的**下载/同步/存储**策略（容量、加密、版本与 manifest 一致性——**待确认**）。
3. **三端构建与体积**：iOS/Android 包体与 Web 首包；离线模型若存在，合规与分发（**待确认**）。

## 6. 分支与影响

| 分支 | 说明 |
|------|------|
| **旧逻辑保留** | 服务端 `online` 默认、现有 `/v1` 契约应尽量向后兼容；环境变量驱动的运维离线模式应继续可用。 |
| **可能废弃/绕开** | 若引入纯客户端 RAG，部分仅服务端 multer 上传路径在离线时不可用，需并行「本地选 PDF → 本地 ingest」分支。 |
| **耦合影响** | `RagTurnDeps` 与 `loadKbRagContext` 当前与单一 `mode` 绑定；每请求双模式会触及会话序列化、嵌入模型 id 校验（offline 已有 `skipModelIdCheck` 先例，见 `v1KbReplaceRoutes` 等 grep 结果）。 |
| **E2E** | `playwright.config.ts` 依赖本机起 `pnpm serve`；新增离线用例需 `E2E_SKIP` 或 mock **或** 无头场景定义。 |
| **Docker** | 镜像内仍为单进程 Node；「移动端离线」与当前 `Dockerfile` 无直接冲突，但若增加同步服务需单独评估。 |

## 7. 边界条件与风险

- **语义**：「断网」= 无互联网 / 无局域网 / 无本机 loopback —— 验收标准需写死一种或分档（否则实现与测试无法对齐）。
- **安全**：主动离线若允许「仅本地 LLM URL」，需继承根 `README` 对 `LOCAL_CHAT_*` 的公网暴露警告；移动端 cleartext 与 ATS（iOS）需索引级评审。
- **并发**：知识库替换与对话并行时的锁（`enqueueKbReplace`）在扩展本地 ingest 时仍须遵守。
- **待补测试**：三端各至少一条「开关 on/off + 主路径」；网络模拟（Chrome offline、RN 断网）；`runtime-info.capabilities` 与 UI 一致性断言。

### 安全与权限影响（索引级）

- 管理 Token（`HTTP_ADMIN_TOKEN` / `EXPO_PUBLIC_HTTP_ADMIN_TOKEN`）在离线/本地路径中是否仍需要、是否应禁止写入日志——需在方案中重申脱敏与最小权限。
- 不把 `ARK_API_KEY` 打入前端静态包（现有 checklist 已强调）在「客户端本地推理」方案中仍适用。

## 8. 待确认清单

1. **「断网」精确范围**：是否必须包含「无法访问本机 `pnpm serve` / Docker」？若是，则必须推断 B 级改造；若否，可优先服务端 offline + 可达 API。
2. **「主动离线」与「被动断网」关系**：勾选是否等价于「即使在线也强制 degraded 管道」？还是「仅在网络不可用时自动启用本地栈」？
3. **离线是否需「入库」**：仅问答已有 `kb_store`，还是断网下也要完成 PDF → chunk → 向量（会显著扩大范围）？
4. **对话生成**：可接受占位句 / 必须 `LOCAL_CHAT_*` 类本机模型 / 三端统一策略？
5. **数据驻留**：知识库与会话是否允许明文落端、是否需要应用锁或系统密钥链（**待确认**）。

## 9. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-05 | 初稿：基于当前仓库的进程级 offline 与三端 HTTP 架构，整理与全端真离线目标的差距与分支。 |

---

## 文档末尾声明（必读）

1. 本文档**仅供实现阶段参考**，不是权威需求规格；**未**保证覆盖需求全部细节。  
2. 相关性图谱基于生成时刻整理，**可能不全面**；有据处仍**可能准确却不完整**。  
3. 仓库会持续演进，**本文与真实代码可能不一致**；实现与测试以当前代码为准，本文作关系线索。  
