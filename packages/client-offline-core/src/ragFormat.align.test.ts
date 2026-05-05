import { Document } from "@langchain/core/documents";
import { describe, expect, it } from "vitest";
import type { ScoredDoc } from "../../api-core/src/ask/retrieve.js";
import {
  buildContextBlock as refBuildContextBlock,
  buildDefaultRagSystemPrompt as refBuildDefaultRagSystemPrompt,
  citationSummaryFromScoredDoc as refCitationSummaryFromScoredDoc,
  truncateReferencesContextBlock as refTruncateReferencesContextBlock,
} from "../../api-core/src/chat/ragFormatting.js";
import {
  buildContextBlock,
  buildDefaultRagSystemPrompt,
  citationSummaryFromScoredDoc,
  truncateReferencesContextBlock,
  type RagScoredDoc,
} from "./ragFormat.js";

function toRefScoredDocs(hits: RagScoredDoc[]): ScoredDoc[] {
  return hits.map((h) => ({
    doc: new Document({ pageContent: h.doc.pageContent, metadata: h.doc.metadata }),
    score: h.score,
  }));
}

describe("ragFormat vs api-core ragFormatting", () => {
  const hits: RagScoredDoc[] = [
    {
      doc: {
        pageContent: "第一行\n第二行  多空格",
        metadata: { source: "a.pdf", chunkIndex: 0 },
      },
      score: 0.91,
    },
    {
      doc: { pageContent: "beta", metadata: { source: "b.pdf", chunkIndex: "x" } },
      score: 0.42,
    },
  ];

  it("buildContextBlock / citationSummaryFromScoredDoc / truncateReferencesContextBlock 与 ref 一致", () => {
    const refHits = toRefScoredDocs(hits);
    expect(buildContextBlock(hits)).toBe(refBuildContextBlock(refHits));

    for (let i = 0; i < hits.length; i++) {
      const idx = i + 1;
      expect(citationSummaryFromScoredDoc(idx, hits[i]!)).toEqual(refCitationSummaryFromScoredDoc(idx, refHits[i]!));
    }

    const block = buildContextBlock(hits);
    for (const maxChars of [50, 200, 10_000]) {
      expect(truncateReferencesContextBlock(block, maxChars)).toBe(
        refTruncateReferencesContextBlock(block, maxChars),
      );
    }
  });

  it("buildDefaultRagSystemPrompt 与 ref 一致（含空参考资料）", () => {
    expect(buildDefaultRagSystemPrompt("")).toBe(refBuildDefaultRagSystemPrompt(""));
    expect(buildDefaultRagSystemPrompt("仅一段")).toBe(refBuildDefaultRagSystemPrompt("仅一段"));
  });
});
