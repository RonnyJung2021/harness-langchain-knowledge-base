import fs from "node:fs/promises";
import { Document } from "@langchain/core/documents";

/**
 * 使用 pdf.js（pdfjs-dist）从 PDF 提取文本，等价于按页切分的 PDFLoader。
 * 与旧版 pdf-parse 相比，对常见工具链生成的 PDF / Node 20+ 更稳。
 */
export async function loadPdfDocuments(absPdfPath: string): Promise<Document[]> {
  const data = new Uint8Array(await fs.readFile(absPdfPath));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data,
    verbosity: 0,
    useSystemFonts: true,
  }).promise;

  const docs: Document[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? String((item as { str: string }).str) : ""))
      .join("")
      .trim();
    docs.push(
      new Document({
        pageContent: pageText,
        metadata: { pdf: { page: pageNum } },
      }),
    );
  }

  const joined = docs.map((d) => d.pageContent).join("\n").trim();
  if (docs.length === 0 || joined.length === 0) {
    throw new Error(
      "PDF 未解析出任何文本：可能是空文件、损坏文件，或仅有扫描图而无文字层（需 OCR 版 PDF）。",
    );
  }
  return docs;
}
