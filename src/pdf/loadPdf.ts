import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "@langchain/core/documents";

/**
 * 使用 LangChain PDFLoader 加载 PDF 文本。
 * @throws 若整本 PDF 无可用文本（空页或仅有扫描图无文本层）
 */
export async function loadPdfDocuments(absPdfPath: string): Promise<Document[]> {
  const loader = new PDFLoader(absPdfPath, { splitPages: true });
  const docs = await loader.load();
  const joined = docs.map((d) => d.pageContent).join("\n").trim();
  if (docs.length === 0 || joined.length === 0) {
    throw new Error(
      "PDF 未解析出任何文本：可能是空文件、损坏文件，或仅有扫描图而无文字层（需 OCR 版 PDF）。",
    );
  }
  return docs;
}
