# 离线 RAG（浏览器 / RN 进程内）实现指南 — Harness 分阶段

> **依据**：`vibe-coding-harness-guide-generator` 技能结构；需求背景见 `project-atlas/offline-mode-cross-platform-requirement-atlas.md`；仓库拓扑见 `project-atlas/REPOSITORY_ATLAS.md`。  
> **硬约束**：断网时 **不依赖** `apps/server` 的 HTTP；检索 + 生成（或等价降级）在 **Web 或 RN JS 运行时**内完成。  
> **参考实现（服务端等价逻辑）**：`packages/api-core/src/providers/offline/stubEmbedding.ts`（`offlineStubVector`）、`packages/api-core/src/ask/retrieve.ts`、`packages/api-core/src/chat/ragTurn.ts`、`packages/api-core/src/providers/offline/stubInference.ts`；客户端现状：`packages/app-shared/src/hooks/useChatPanel.ts`（纯 `/v1`）。

---

## 总览：架构决策（实现前先读）

| 主题 | 建议 | Harness 对齐 |
|------|------|----------------|
| 新代码放哪 | 新增 **`packages/client-offline-core`**（仅 `fetch`/`crypto`/数组运算，无 `node:fs`），被 `app-shared` 依赖 | 工具边界清晰，避免 `api-core` 整包进浏览器 |
| 向量数据从哪来 | 在线时通过 **新只读 API**（如 `GET /v1/knowledge-base/bundle`）拉取 `manifest.json` + `vectors.json` 快照，写入端存储 | 状态落盘、可恢复 |
| 检索算法 | 与 `retrieveRelevantChunks` 同语义：先 `similaritySearchWithScore` 取池子，再 `scoreMin`/`topK` 与 degraded 回退（见 `packages/api-core/src/ask/retrieve.ts`） | 任务契约可验证 |
| 生成 | **V1** 复用服务端占位句精神（`OfflineStubInferenceProvider`）；**V2** 可接端侧模型（另立项） | 反馈回路：用户可见「离线降级」说明 |
| 主动离线 | 用户勾选 **优先本地管道**；与 `navigator.onLine` / `@react-native-community/netinfo` 组合成「有效离线」谓词 | 状态管理 + 错误分类 |

以下阶段按依赖顺序执行；每步末尾有可勾选验收项。

---

## 阶段 0：契约冻结与对齐用例

### 01. 冻结「端内 RAG 一步」的输入输出

**目的**：避免实现中途改接口，导致 Web/RN 分叉。

**Agent 输入框粘贴**：

```text
在 packages/shared（或新建 packages/client-offline-core 内的 types.ts）中增加纯类型：
- LocalKbBundle：{ manifest: KbManifestV1 兼容形状; vectors: SerializedMemoryVector[] }（字段名与 kb_store JSON 一致）
- LocalRagTurnInput：{ userText: string; history: ChatMessage[] }
- LocalRagTurnOutput：与 PostSessionMessageResponseBody 对齐：{ answer: string; citations: CitationSummary[]; degraded?: boolean }
不实现逻辑，仅类型 + JSDoc 说明「与 POST /v1/sessions/:id/messages 成功体对齐，便于 UI 复用」。
参考 packages/shared/src/httpShape.ts 与 packages/api-core/src/store/localVectorStore.ts 的 SerializedMemoryVector / KbManifestV1。
```

**验收标准**：

- [ ] `pnpm -r run typecheck` 通过。
- [ ] 无 `node:` 依赖被引入 `shared` 的浏览器消费路径（若类型放在 client-offline-core，则 shared 可不改）。

**Harness 对齐**：任务表达（要素 1）— I/O 无歧义。

---

### 02. 黄金用例：与服务端 offline 对齐

**目的**：端内核与 `api-core` 同库、同 `vectors.json` 时，**Top-K 文档顺序与分数阈值行为一致**（允许浮点末位差异）。

**Agent 输入框粘贴**：

```text
在 packages/client-offline-core 增加 dev-only 或 vitest 测试：
1) fixtures：从仓库 kb_store 复制一小段脱敏 vectors（<20 条）到 __fixtures__/vectors.small.json
2) 用固定 userText 调用「待实现的」localRetrieveRelevantChunks
3) 同一 fixture 在 Node 脚本里调用 packages/api-core 的 retrieveRelevantChunks（可建 tsx 脚本于 scripts/）对比 doc.metadata 或 content 的前 80 字符序列
若 LangChain MemoryVectorStore 的 score 与手写余弦不一致，在 client-offline-core 内显式记录「与 LC 对齐的公式」注释并调整直到黄金用例通过。
```

**验收标准**：

- [ ] 同 fixture、同问题下，**degraded 标志**与 **命中条数**与 Node 路径一致（或文档记载已知差异及原因）。

**Harness 对齐**：验证机制（要素 8）。

---

## 阶段 1：进程内检索核（无 LangChain 依赖）

### 11. 移植 stub 嵌入向量

**目的**：查询向量与入库向量同一套确定性规则，才能检索。

**Agent 输入框粘贴**：

```text
在 packages/client-offline-core/src/stubEmbed.ts 实现与 packages/api-core/src/providers/offline/stubEmbedding.ts 完全相同的 offlineStubVector 与 embedTexts(texts: string[], dimensions: number, seed?: string)。
禁止从 api-core 直接 import（避免拉入 fs/langchain）；通过复制算法与单元测试字符级对齐 hash 结果。
导出 getQueryEmbedding(userText, dimensions)。
```

**验收标准**：

- [ ] 对至少 3 组 `(dimensions, key)`，与 `api-core` 中 `offlineStubVector` 输出逐元素相等或误差 <1e-10。

**Harness 对齐**：工具治理 — 依赖边界干净。

---

### 12. 内存向量库 + similaritySearchWithScore

**目的**：在纯 JS 中复现 `MemoryVectorStore.similaritySearchWithScore` 的排序语义（余弦相似度；向量已单位化时等价点积）。

**Agent 输入框粘贴**：

```text
在 packages/client-offline-core/src/memoryVectorIndex.ts：
- 输入：SerializedMemoryVector[]
- 实现 cosineSimilarity(a,b) 与 searchWithScore(queryEmbedding, poolSize)：返回 { doc: { pageContent, metadata }; score }[]，score 越大越相关，与 packages/api-core/src/ask/retrieve.ts 中 filter 逻辑兼容
- poolSize 默认 max(topK*8, 24) 由调用方传入（RAG 配置来自常量或后续注入）
```

**验收标准**：

- [ ] 阶段 02 的黄金用例通过。

**Harness 对齐**：上下文组织 — 只加载必要向量，不整仓扫描时可分页（V2 优化点，V1 可全量内存）。

---

### 13. 封装 retrieveRelevantChunks 的 TS 移植

**Agent 输入框粘贴**：

```text
在 packages/client-offline-core/src/localRetrieve.ts 实现函数 localRetrieveRelevantChunks(vectors, questionEmbedding, cfg: { topK; scoreMin })，逻辑逐行对照 packages/api-core/src/ask/retrieve.ts。
返回 { hits: { doc, score }[]; degraded: boolean }，doc 形状需能喂给后续 buildContextBlock 的移植版。
```

**验收标准**：

- [ ] `degraded` 与 `retrieve.ts` 分支一致。

**Harness 对齐**：错误分类前置 — 空 hits 时行为明确（可返回 degraded=true 的空数组，由上层 UI 提示）。

---

## 阶段 2：拼装 system 上下文 + 占位生成

### 21. 移植最小 rag 格式化

**目的**：与线上一致的「参考资料块」策略，减少模型（占位）跑偏。

**Agent 输入框粘贴**：

```text
阅读 packages/api-core/src/chat/ragFormatting.ts 中与 buildContextBlock、citationSummaryFromScoredDoc、truncateReferencesContextBlock 相关的纯函数；将不依赖 Node 的部分复制到 client-offline-core/src/ragFormat.ts（若依赖 env，改为函数参数传入 maxChars）。
复制 packages/api-core 中与「只根据参考资料回答」同义的 buildSystemPrompt 模板，或从 apps/server 路由层找到最终字符串常量来源，保证离线 system 与线上一致。
```

**验收标准**：

- [ ] 同 hits 下，system 文本与线上一致或在单测中快照比对（允许空白差异一行内）。

**Harness 对齐**：上下文裁剪（要素 4）— `maxChars` 来自参数，默认可对齐 `ARK_RAG_CONTEXT_MAX_CHARS` 的数值（写死在 client 默认或从同步 manifest 扩展读取）。

---

### 22. 占位生成 + 整轮 runLocalRagTurn

**Agent 输入框粘贴**：

```text
在 packages/client-offline-core/src/localRagTurn.ts 实现 async function runLocalRagTurn(input: LocalRagTurnInput, bundle: LocalKbBundle, opts?: { ragConfig; contextLimits }):
1) dimensions 从 bundle.vectors[0].embedding.length 读取，空数组抛明确错误
2) embed 用户句 → localRetrieveRelevantChunks → 拼装 messages 结构（逻辑对齐 packages/api-core/src/chat/ragTurn.ts 的 prepareRagTurnMessages，可不引 LangChain Message 类，用 role/content 数组即可）
3) inference.chat：V1 直接返回 packages/api-core/src/providers/offline/stubInference.ts 中 OFFLINE_REPLY 同文案或常量化共享
4) 返回 LocalRagTurnOutput
```

**验收标准**：

- [ ] 断网环境下（不启动 server）在 Node 中用 tsx 调用 `runLocalRagTurn` 能返回非空 `answer` 与 `citations`（citations 条数 ≤ topK）。

**Harness 对齐**：反馈回路 — 占位文案明确告知「检索已执行、生成为离线占位」。

---

## 阶段 3：端上知识包 — 存储与同步

### 31. 服务端：只读导出 bundle（在线拉取）

**目的**：浏览器/RN 事先拿到与 `kb_store` 一致的 JSON。

**Agent 输入框粘贴**：

```text
在 apps/server 新增 GET /v1/knowledge-base/bundle（路径命名与现有 POST /v1/knowledge-base/replace 并列）：
- 鉴权：与 replace 相同的管理 Bearer（复用 requireAdminBearer 模式，见 apps/server/src/requireAdminBearer.ts 与 v1KbReplaceRoutes.ts）
- 响应：{ manifest, vectors } JSON，从 repoRoot kb_store 读取；大文件考虑 Content-Encoding gzip（可选）
- 错误：无 manifest 或空向量时 404 + 稳定 error.code
在 docs/KB_API.md 增加该端点说明；禁止在响应中包含 ARK_API_KEY。
```

**验收标准**：

- [ ] `curl` 带合法 admin token 能下载与磁盘 `kb_store` 一致的 JSON。
- [ ] 无 token 返回 401。

**Harness 对齐**：安全边界（要素 7）。

---

### 32. 抽象存储接口 + Web 实现

**Agent 输入框粘贴**：

```text
在 packages/client-offline-core/src/storage/types.ts 定义 interface KbBundleStore { load(): Promise<LocalKbBundle | null>; save(bundle: LocalKbBundle): Promise<void>; clear(): Promise<void> }
在 storage/webIndexedDb.ts 用 idb 或原生 IndexedDB 实现（键名版本化如 kb-rag-bundle:v1）；注意 JSON 大小，必要时拆块存储（vectors 数组分片），load 时合并。
```

**验收标准**：

- [ ] Chrome 下保存 5MB 级 mock bundle 后可读回，`pnpm typecheck` 通过。

**Harness 对齐**：状态落盘与恢复（要素 4）。

---

### 33. RN 实现（Android / iOS 共用）

**Agent 输入框粘贴**：

```text
在 storage/rnAsyncStorage.ts（或 expo-file-system）实现 KbBundleStore：
- 若 vectors 过大，使用 expo-file-system 写单文件 + AsyncStorage 仅存路径与 manifest 摘要；避免 AsyncStorage 单行超限
- 与 Web 共用 load/save/clear 语义
在 apps/mobile 初始化时注入具体 Store 实例（依赖倒置，不在 core 里 import expo）
```

**验收标准**：

- [ ] Android 模拟器与 iOS 模拟器各手动：在线 sync → 飞行模式 → 仍能 `runLocalRagTurn`。

**Harness 对齐**：工具边界 — RN 细节不泄漏进 core。

---

### 34. 同步器：在线时拉 bundle

**Agent 输入框粘贴**：

```text
在 packages/app-shared/src/offline/syncKbBundle.ts（路径自定）实现 syncKbBundleFromServer(apiBaseUrl, adminToken, store: KbBundleStore)：
- fetch GET .../knowledge-base/bundle，校验 JSON schema 最小字段
- 成功后 store.save；失败分类：401 / 413 / 网络 → 抛可枚举错误码供 UI 翻译
在 DiagnosticsPanel 或设置区增加「同步知识库到本机」按钮（仅在线显示）
```

**验收标准**：

- [ ] 同步成功后本地 `load()` 非空。

**Harness 对齐**：错误分类（要素 6）— 网络 vs 鉴权分流。

---

## 阶段 4：「主动离线」状态机与统一聊天传输层

### 41. 偏好持久化 + 有效离线谓词

**Agent 输入框粘贴**：

```text
在 packages/app-shared 新增 OfflinePreferenceProvider（React Context）：
- 字段：preferOffline: boolean; setPreferOffline(v: boolean)
- 持久化：Web localStorage；RN AsyncStorage（用同一 key 前缀）
新增 hook useEffectiveOffline(preferOffline: boolean): boolean：
- Web：preferOffline || !navigator.onLine
- RN：preferOffline || !isConnected（使用 @react-native-community/netinfo，在 package.json 增加依赖）
导出纯函数 effectiveOfflineForTesting 便于单测。
```

**验收标准**：

- [ ] 切换勾选后无需重启 App 即影响下一轮发送路径。

**Harness 对齐**：状态管理（要素 4）。

---

### 42. 改造 useChatPanel（或平行 useLocalChatPanel）

**目的**：同一 UI 组件，内部走 HTTP 或端内 RAG。

**Agent 输入框粘贴**：

```text
阅读 packages/app-shared/src/hooks/useChatPanel.ts 与 useSessionApi.ts。
方案 A（推荐）：新增 useChatPanelDualMode({ apiBaseUrl, sessionId, effectiveOffline, bundleStore, onNotice })：
- effectiveOffline === false：保持现有 fetch /v1/sessions/... 行为
- effectiveOffline === true：sessionId 可为本地 UUID（useSessionApi 扩展 newLocalSession() 仅客户端生成）；send 时不再 fetch，改为 append 用户消息、调用 runLocalRagTurn、再 append 助手消息；messages 状态全在内存（可选落盘 V2）
- busy / 错误处理与线上一致风格（使用现有 errorToBannerText 模式扩展 OFFLINE_* 码）
若改动面过大，可保留 useChatPanel 不变，新增 useOfflineChatPanel 再在 KbWorkspaceApp 组合。
```

**验收标准**：

- [ ] 在线 + 未勾选：行为与改前一致（回归 smoke）。
- [ ] 离线 + 已同步 bundle：发送问题可得 answer + citations。
- [ ] 离线 + 无 bundle：明确 Banner「未同步知识库」，不发崩溃。

**Harness 对齐**：任务契约 — 双路径显式分支，禁止静默失败。

---

### 43. UI：勾选「主动使用离线模式」

**Agent 输入框粘贴**：

```text
在 packages/app-shared 主界面或 DiagnosticsPanel 增加 Switch+说明文案：
- 说明：主动离线仍需要先「同步知识库」；生成为降级占位（与 README 离线说明一致）
与 GET /v1/runtime-info 的展示解耦：runtime-info 描述服务端；本开关描述客户端管道（避免用户误解）
```

**验收标准**：

- [ ] 三端文案一致（中英择一，与项目现有语言一致）。

**Harness 对齐**：反馈回路 — UI 与真实能力一致。

---

## 阶段 5：Web 集成

### 51. Vite 与依赖打包

**Agent 输入框粘贴**：

```text
将 @kb-rag/client-offline-core 加入 apps/web 与 packages/app-shared 的依赖（workspace:*）。
检查 vite.config.ts 是否需 alias；确保不打包 node:fs。
可选：Service Worker 仍不缓存 /v1（保持 README 约定），仅缓存静态资源；bundle 存 IndexedDB 与 SW 无关。
```

**验收标准**：

- [ ] `pnpm dev:web` 无解析错误；生产 `pnpm build:web` 产物体积可接受（记录 baseline）。

**Harness 对齐**：熵管理 — 不把大模型打进首包（V1）。

---

### 52. 联调清单（Web）

**验收标准**（手工）：

- [ ] 在线：同步 → 对话正常。
- [ ] DevTools Offline：勾选主动离线或未勾选但 offline → 仍能对话。
- [ ] 未同步 + 离线 → 错误提示可读。

---

## 阶段 6：React Native（Android / iOS）集成

### 61. 依赖与权限

**Agent 输入框粘贴**：

```text
在 apps/mobile 引入 netinfo；检查 iOS Info.plist 是否需 NSAppTransportSecurity（若仅 https API 则不变）；离线不发起网络时无 ATS 问题。
将 KbBundleStore 的 RN 实现在 App.tsx 或根 Provider 注入 app-shared。
```

**验收标准**：

- [ ] `pnpm dev:mobile` 在双端能打开设置并切换开关。

---

### 62. 联调清单（Native）

**验收标准**：

- [ ] Android 飞行模式 + 已同步：对话可用。
- [ ] iOS 飞行模式同上。
- [ ] 大 bundle（若可构造）：冷启动 load 在 3s 内或显示加载态（按产品要求调参）。

---

## 阶段 7：安全、错误与 Harness 回归

### 71. 密钥与日志

**Agent 输入框粘贴**：

```text
审计：client-offline-core 与 bundle JSON 内不得包含 ARK_API_KEY；同步接口仅用 admin token；禁止 console.log 整包 vectors。
```

**验收标准**：

- [ ] `grep -R "ARK_API_KEY" packages/client-offline-core` 无结果。

**Harness 对齐**：安全边界（要素 7）。

---

### 72. 错误码枚举与用户可见翻译

**Agent 输入框粘贴**：

```text
在 shared 或 app-shared 定义 OFFLINE_NO_BUNDLE、OFFLINE_CORRUPT_BUNDLE、OFFLINE_SYNC_FAILED 等；DiagnosticsPanel 网络正则已存在，可扩展匹配「用户主动离线」场景提示。
```

**验收标准**：

- [ ] 每种错误对应一条非技术用户可理解的横幅文案。

**Harness 对齐**：错误分类（要素 6）+ 反馈翻译（要素 5）。

---

## 阶段 8：验证与交付

### 81. 自动化

**Agent 输入框粘贴**：

```text
为 client-offline-core 配置 vitest（或沿用根 tsx 脚本）；对 stubEmbed、localRetrieve、runLocalRagTurn 做单元测试。
Playwright：可选新增用例「先同步 mock bundle 再 mock offline」；若成本高，在 project-atlas 记录手工矩阵为发布门槛。
```

**验收标准**：

- [ ] CI 可跑部分（不要求 ARK_KEY）；`pnpm test` 或新 filter 绿灯。

---

### 82. 文档与 REPOSITORY_ATLAS 增量

**Agent 输入框粘贴**：

```text
更新 README「离线」小节：区分「服务端 AI_RUNTIME_MODE=offline」与「端内完全离线」；列出同步按钮、开关、存储位置。
更新 project-atlas/REPOSITORY_ATLAS.md 增加 packages/client-offline-core 一行。
```

**验收标准**：

- [ ] 新贡献者按 README 可完成 Web 离线 smoke。

**Harness 对齐**：熵管理 — 知识沉淀在仓库内。

---

## 附录 A：关键文件速查

| 用途 | 路径 |
|------|------|
| 服务端 RAG 一轮 | `packages/api-core/src/chat/ragTurn.ts` |
| 检索阈值 | `packages/api-core/src/ask/retrieve.ts`、`packages/api-core/src/ask/ragEnv.ts` |
| 桩向量 | `packages/api-core/src/providers/offline/stubEmbedding.ts` |
| 占位回答 | `packages/api-core/src/providers/offline/stubInference.ts` |
| 向量磁盘格式 | `packages/api-core/src/store/localVectorStore.ts` |
| 会话 HTTP | `packages/app-shared/src/hooks/useChatPanel.ts` |
| API 类型 | `packages/shared/src/httpShape.ts` |
| 管理上传 | `apps/server/src/v1KbReplaceRoutes.ts` |

---

## 附录 B：可选后续（非 V1 必做）

- 端侧 ONNX / `llama.rn` / WebGPU 生成，替换占位 `OFFLINE_REPLY`。
- 向量分片懒加载与 WASM 加速相似度。
- 客户端会话持久化加密（Keychain / Web Crypto）。

---

**Harness 总检清单（交付前自评）**

- [ ] 输入/输出契约（类型）已冻结。  
- [ ] 端内路径无 Node 专属 API。  
- [ ] 主动离线与网络离线组合逻辑有单测或脚本。  
- [ ] 同步、检索、生成失败均有用户可见反馈。  
- [ ] 密钥不进 bundle、不进日志。  
- [ ] Web + Android + iOS 手工矩阵已勾选。  
