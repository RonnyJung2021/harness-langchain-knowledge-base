import { Embeddings } from "@langchain/core/embeddings";

export type ArkMultimodalEmbeddingsParams = {
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: 1024 | 2048;
  /** embedDocuments 时并发请求上限 */
  concurrency?: number;
};

/**
 * 方舟「多模态向量化」模型（如 doubao-embedding-vision-*）：
 * 使用 `/v1/embeddings` 兼容路径，但 `input` 须为带 `type: "text"` 的多模态片段，而非纯字符串数组。
 * @see 火山方舟向量化 API 文档
 */
export class ArkMultimodalEmbeddings extends Embeddings {
  private readonly apiKey: string;

  private readonly url: string;

  private readonly model: string;

  private readonly dimensions: 1024 | 2048;

  private readonly concurrency: number;

  constructor(params: ArkMultimodalEmbeddingsParams) {
    super({});
    this.apiKey = params.apiKey;
    this.model = params.model;
    this.dimensions = params.dimensions;
    this.concurrency = Math.max(1, params.concurrency ?? 4);
    const base = params.baseUrl.replace(/\/+$/, "");
    // 多模态向量化须走专用路径，与标准 OpenAI /embeddings（纯字符串 input）不同
    this.url = `${base}/embeddings/multimodal`;
  }

  private async embedOne(text: string): Promise<number[]> {
    const body = {
      model: this.model,
      input: [{ type: "text", text }],
      encoding_format: "float",
      dimensions: this.dimensions,
      sparse_embedding: { type: "disabled" },
    };
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(
        `方舟多模态 Embeddings 失败 HTTP ${res.status}：${raw.slice(0, 800)}`,
      );
    }
    let json: {
      data?:
        | { embedding?: number[] }
        | Array<{ embedding?: number[] }>;
    };
    try {
      json = JSON.parse(raw) as {
        data?: { embedding?: number[] } | Array<{ embedding?: number[] }>;
      };
    } catch {
      throw new Error(`方舟 Embeddings 响应非 JSON：${raw.slice(0, 200)}`);
    }
    let emb: number[] | undefined;
    if (Array.isArray(json.data)) {
      emb = json.data[0]?.embedding;
    } else if (json.data && typeof json.data === "object") {
      emb = json.data.embedding;
    }
    if (!emb?.length) {
      throw new Error(
        "方舟 Embeddings 响应缺少向量：多模态接口通常为 data.embedding；若为数组形态则取 data[0].embedding。",
      );
    }
    return emb;
  }

  override async embedQuery(document: string): Promise<number[]> {
    return this.embedOne(document);
  }

  override async embedDocuments(documents: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < documents.length; i += this.concurrency) {
      const batch = documents.slice(i, i + this.concurrency);
      const vecs = await Promise.all(batch.map((t) => this.embedOne(t)));
      out.push(...vecs);
    }
    return out;
  }
}
