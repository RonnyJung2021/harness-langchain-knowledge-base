import type { EmbeddingProvider } from "../types.js";

function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 确定性单位向量，维度与 kb_store 一致即可用于检索占位 */
export function offlineStubVector(dimensions: number, key: string): number[] {
  const out = new Array<number>(dimensions);
  let h = hashString(key);
  for (let i = 0; i < dimensions; i++) {
    h ^= (i + 1) * 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h ^= h >>> 13;
    out[i] = (h >>> 0) / 0xffffffff;
  }
  const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
  return out.map((x) => x / norm);
}

export class OfflineStubEmbeddingProvider implements EmbeddingProvider {
  private readonly dimensions: number;

  private readonly seed: string;

  constructor(dimensions: number, seed = "offline-stub-v1") {
    this.dimensions = dimensions;
    this.seed = seed;
    if (!Number.isFinite(dimensions) || dimensions < 1 || dimensions > 8192) {
      throw new Error(`OfflineStubEmbeddingProvider：非法维度 ${String(dimensions)}`);
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map((t, i) => offlineStubVector(this.dimensions, `${this.seed}:${String(i)}:${t}`));
  }
}
