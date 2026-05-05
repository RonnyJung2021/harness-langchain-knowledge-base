/**
 * 生成 `packages/client-offline-core/__fixtures__/vectors.small.json`：
 * 使用与线上一致的 `OfflineStubEmbeddingProvider` 批量嵌入，保证与 `MemoryVectorStore` 兼容。
 *
 * 运行：仓库根目录 `pnpm exec tsx scripts/gen-offline-golden-fixture.ts`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OfflineStubEmbeddingProvider } from "../packages/api-core/src/providers/offline/stubEmbedding.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIM = 32;
const texts = [
  "第一节 介绍火箭发动机基本原理",
  "第二节 燃料泵温度阈值",
  "猫的行为模式与居家环境",
  "犬类训练中的正向强化",
  "向量检索评分与 topK",
  "manifest.json 字段说明",
  "相似度阈 scoreMin 默认值",
  "方舟多模态嵌入与纯文本模式",
  "离线占位答复不适用生产",
  "kb_store 目录结构简述",
  "会话持久化 ARK_SESSION_PERSIST",
  "Express 限流与 JSON body 上限",
  "Playwright E2E 与 ARK_API_KEY",
  "Docker Compose 健康检查 wget",
  "本节小结：离线黄金夹具",
];

async function main(): Promise<void> {
  const emb = new OfflineStubEmbeddingProvider(DIM);
  const embeddings = await emb.embedTexts(texts);
  const rows = texts.map((content, i) => {
    const v = embeddings[i];
    if (v === undefined) {
      throw new Error(`missing embedding index ${String(i)}`);
    }
    return {
      content,
      embedding: v,
      metadata: {
        source: "_golden_fixture.pdf",
        chunkIndex: i,
        topic: i % 3 === 0 ? "tech" : "animal",
      },
    };
  });
  const outDir = path.join(__dirname, "../packages/client-offline-core/__fixtures__");
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "vectors.small.json");
  writeFileSync(fp, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`Wrote ${String(rows.length)} rows dim=${String(DIM)} -> ${fp}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
