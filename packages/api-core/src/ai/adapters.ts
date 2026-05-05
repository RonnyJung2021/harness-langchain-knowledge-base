import type { EmbeddingProvider } from "../providers/types.js";
import type { InferenceProvider } from "../providers/types.js";
import type { ArkLikeChat, ArkLikeEmbeddings } from "./interfaces.js";

export function inferenceProviderAsArkLike(p: InferenceProvider): ArkLikeChat {
  return p;
}

export function embeddingProviderAsArkLike(p: EmbeddingProvider): ArkLikeEmbeddings {
  return {
    embedDocuments: (texts) => p.embedTexts(texts),
    embedQuery: async (text) => {
      const rows = await p.embedTexts([text]);
      const row = rows[0];
      if (row === undefined) {
        throw new Error("EmbeddingProvider 返回空向量");
      }
      return row;
    },
  };
}

export function arkLikeEmbeddingsToEmbeddingProvider(e: ArkLikeEmbeddings): EmbeddingProvider {
  return {
    embedTexts: (texts) => e.embedDocuments(texts),
  };
}

export function arkLikeChatToInferenceProvider(chat: ArkLikeChat): InferenceProvider {
  return chat as InferenceProvider;
}
