# 知识库操作说明（熵管理 / 稳定换书）

本文约定「加一本新书、整库替换、环境与安全」的标准动作，避免依赖口头记忆。对齐 Harness：**状态落盘可审计、操作可复跑、边界写死**。

---

## 1. 新增一本 PDF（标准步骤）

1. 将 PDF 复制到仓库根目录下的 **`pdfs/`**（可与现有文件并存）。  
2. 确认已配置 **`.env`**（见下文「环境变量」）。  
3. 在仓库根目录执行入库（路径相对仓库根解析）：

   ```bash
   pnpm ingest -- pdfs/你的文件名.pdf
   ```

4. 终端应输出块数量、耗时及 `kb_store/vectors.json`、`kb_store/manifest.json` 写入路径。  
5. 提问验证：

   ```bash
   pnpm ask -- "用三句话概括这本书在讲什么？"
   ```

**说明**：同一 `source`（同一相对路径）再次 ingest 时，会先删除该来源在向量库中的旧块再写入新块，避免重复；其他已入库的 PDF 不受影响。

---

## 2. 替换整库知识（清理 `kb_store`）

在要**清空向量与清单、从零重新建库**时（例如换一批完全不同的书、或向量模型维度已变更需重建）：

### 方式 A：使用脚本（推荐）

在仓库根目录执行：

```bash
pnpm clean:kb
```

将删除 `kb_store/vectors.json` 与 `kb_store/manifest.json`（**不删除** `kb_store/.gitkeep`）。

### 方式 B：手动删除

```bash
rm -f kb_store/vectors.json kb_store/manifest.json
```

（Windows 无 `rm` 时，可手动删除上述两个文件，或使用 Git Bash / WSL 执行同等命令。）

清理后请对需要保留的 PDF **重新执行** `pnpm ingest -- ...`。

---

## 3. 环境变量说明与方舟控制台（截图占位）

以下变量写在仓库根目录 **`.env`**（勿提交版本库，见第四节）。复制自 **`.env.example`** 后逐项填写。

| 变量 | 含义 |
|------|------|
| `ARK_API_KEY` | 方舟 API Key（Bearer 鉴权）。 |
| `ARK_BASE_URL` | 推理接入 Base URL；留空则默认 `https://ark.cn-beijing.volces.com/api/v3`。 |
| `ARK_CHAT_MODEL` | 对话模型 **Endpoint ID**（控制台接入点）。 |
| `ARK_EMBED_MODEL` | 向量模型 **Endpoint ID**（与对话可为不同接入点）。 |
| `ARK_EMBED_INPUT_MODE` | `multimodal`（默认）或 `text`；多模态走 `.../embeddings/multimodal`。 |
| `ARK_EMBED_DIMENSIONS` | 多模态向量维度：`1024` 或 `2048`，须与控制台一致。 |
| `ARK_RAG_TOP_K` | 可选；RAG 检索条数上限，默认 `4`。 |
| `ARK_RAG_SCORE_MIN` | 可选；相似度下限，默认 `0.35`。 |

**方舟控制台截图占位（文字说明）**

- **[截图占位 1]**：火山引擎方舟控制台 → API Key 管理页面：展示「创建 / 复制 Key」的位置（实际文档中可粘贴你打码后的截图）。  
- **[截图占位 2]**：在线推理 → 接入点列表：展示 **Base URL**、**Endpoint ID**（对话模型、向量模型各一条）在界面中的对应字段。  
- **[截图占位 3]**：向量模型详情页：展示 **维度**、**多模态 / 文本** 等与 `ARK_EMBED_*` 对齐的字段。

将上述截图放入团队 Wiki 或内部文档时，注意对 Key 与账号信息打码。

---

## 4. 安全与版本库边界

1. **`.env`**：含密钥与端点信息，**禁止**提交到 git。仓库 **`.gitignore`** 已忽略 `.env`。  
2. **`kb_store/*.json`**：向量与元数据可能反映业务内容，**不提交**；仅保留 **`kb_store/.gitkeep`** 占位。`.gitignore` 已忽略 `kb_store/*.json`。  
3. **`pdfs/`**：用户 PDF 可能含隐私或版权材料，默认**不强制**忽略整个目录；若需保密，请将具体 PDF 路径加入 `.gitignore` 或使用私有副本目录，勿将敏感文件 push 到公开仓库。  
4. **协作**：PR / 分享仓库前检查 `git status`，确认无 `.env`、无客户 PDF、无 `kb_store` 数据文件被误加入。

---

## 5. 与 Harness「熵管理」的对应关系

| 风险 | 本文中的固定动作 |
|------|------------------|
| 换书后向量混杂旧内容 | 整库替换时先 **`pnpm clean:kb`** 再 ingest；单书更新用同路径覆盖 ingest。 |
| 密钥泄露 | `.env` 不入库；控制台轮换 Key。 |
| 操作不可复现 | 步骤写死为「复制 → ingest → ask / smoke」；验收可用 `pnpm ingest:smoke`。 |

文档版本与实现指南阶段 E 对齐；若命令变更，以根目录 `README.md` 与 `package.json` 的 `scripts` 为准。
