# kb-rag-local

本地 PDF 知识库问答（ingest + ask RAG 流水线；依赖方舟 API）。

## 使用说明

1. 将 PDF 放入目录 `pdfs/`。  
2. 复制 `cp .env.example .env`，填写 `ARK_API_KEY` 等变量。  
3. 安装依赖：`pnpm install`  
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
