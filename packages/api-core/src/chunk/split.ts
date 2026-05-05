import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Document } from "@langchain/core/documents";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 120,
});

/** 递归字符切分（chunkSize / chunkOverlap 可按中文语料调参）。 */
export async function splitDocumentsToChunks(
  documents: Document[],
): Promise<Document[]> {
  return splitter.splitDocuments(documents);
}
