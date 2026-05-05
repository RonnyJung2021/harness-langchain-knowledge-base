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
export { OFFLINE_STUB_REPLY } from "./offlineStubReply.js";
export {
  assembleLocalRagMessages,
  runLocalRagTurn,
  trimHistoryForRagModel,
  type LocalChatContextLimits,
  type LocalRagChatMessage,
  type LocalRagTurnOpts,
} from "./localRagTurn.js";
export type { KbBundleStore } from "./storage/types.js";
export {
  chunkSerializedVectors,
  createWebIndexedDbKbBundleStore,
  KB_BUNDLE_STORE_SCHEMA_VERSION,
} from "./storage/webIndexedDb.js";
