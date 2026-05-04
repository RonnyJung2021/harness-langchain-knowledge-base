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

换书、清空向量、环境变量与安全边界等运维约定见 **`docs/KB_OPERATIONS.md`**。

## 验收

对应实现指南 **C2**：`package.json` 中已提供脚本 **`ingest:smoke`**。行为如下：

1. **最小 PDF**：若仓库中尚无 `pdfs/_smoke.pdf`，则调用 `scripts/gen-smoke-pdf.py` 生成（**优先几十字中文**；若本机找不到常见 CJK 字体则退化为英文长句，仍可用于管道验收）。需本机 **Python 3** 与 **reportlab**（`pip install reportlab`）。  
2. **跑入库**：等价于对 `pdfs/_smoke.pdf` 执行 `pnpm ingest -- pdfs/_smoke.pdf`（需已配置 `.env` 且方舟 API 可用）。  
3. **Harness 断言**：命令**末尾**打印 `kb_store` 下 `vectors.json`、`manifest.json` 的**文件大小**，并断言 **`chunk > 0`**（否则进程以非零码退出）。

```bash
pnpm ingest:smoke
```

默认 **`ARK_EMBED_INPUT_MODE=multimodal`（可省略）**：面向方舟「多模态向量化」端点，请求 **`POST {ARK_BASE_URL}/embeddings/multimodal`**，`input` 为内容片段数组；纯文本块使用 `[{ "type": "text", "text": "..." }]`。`ARK_EMBED_DIMENSIONS` 须与控制台（1024 / 2048）一致。若接入点为**纯文本** OpenAI 兼容 `.../embeddings`，设置 **`ARK_EMBED_INPUT_MODE=text`**。
