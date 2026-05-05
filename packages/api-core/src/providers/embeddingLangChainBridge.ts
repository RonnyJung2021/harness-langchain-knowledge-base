import { Embeddings } from "@langchain/core/embeddings";
import type { EmbeddingProvider } from "./types.js";

/**
 * 将 {@link EmbeddingProvider} 接到 LangChain {@link MemoryVectorStore} 等组件。
 */
class EmbeddingProviderLangChainBridge extends Embeddings {
  private readonly provider: EmbeddingProvider;

  constructor(provider: EmbeddingProvider) {
    super({});
    this.provider = provider;
  }

  override embedDocuments(documents: string[]): Promise<number[][]> {
    return this.provider.embedTexts(documents);
  }

  override embedQuery(document: string): Promise<number[]> {
    return this.provider.embedTexts([document]).then((rows) => {
      const row = rows[0];
      if (row === undefined) {
        throw new Error("EmbeddingProvider 返回空向量");
      }
      return row;
    });
  }
}

export function embeddingProviderToLangChain(provider: EmbeddingProvider): Embeddings {
  return new EmbeddingProviderLangChainBridge(provider);
}
