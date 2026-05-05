export { embedTexts, getQueryEmbedding, offlineStubVector } from "./stubEmbed.js";
export { langchainCosineSimilarity } from "./langchainCosine.js";
export {
  cosineSimilarity,
  searchWithScore,
  type MemoryVectorSearchHit,
} from "./memoryVectorIndex.js";
export {
  localRetrieveRelevantChunks,
  type LocalRetrievedDoc,
  type LocalScoredHit,
  type RagRetrievalConfigLite,
} from "./localRetrieve.js";
export {
  buildContextBlock,
  buildDefaultRagSystemPrompt,
  buildSystemPrompt,
  citationSummaryFromScoredDoc,
  formatCitationLine,
  metaString,
  REFERENCES_CONTEXT_FRAGMENT_SEPARATOR,
  truncateReferencesContextBlock,
  type RagScoredDoc,
} from "./ragFormat.js";
