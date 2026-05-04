# kb-rag-local

本地 PDF 知识库问答（阶段 A：可编译空壳；检索与问答逻辑尚未实现）。

## 使用说明

1. 将 PDF 放入目录 `pdfs/`。  
2. 复制 `cp .env.example .env`，填写 `ARK_API_KEY` 等变量。  
3. 安装依赖：`pnpm install`  
4. 编译：`pnpm run build`  
5. 后续阶段完成后：入库 `pnpm ingest`，提问 `pnpm ask`。
