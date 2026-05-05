import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LocalKbBundle, LocalRagTurnInput, SerializedMemoryVector } from "@kb-rag/shared";
import { OFFLINE_STUB_REPLY } from "./offlineStubReply.js";
import { runLocalRagTurn } from "./localRagTurn.js";

describe("runLocalRagTurn", () => {
  it("空 vectors 抛错", async () => {
    const bundle: LocalKbBundle = {
      manifest: {
        version: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
        embeddingModel: "offline/stub",
        totalChunks: 0,
        sources: [],
      },
      vectors: [],
    };
    const input: LocalRagTurnInput = { userText: "hi", history: [] };
    await expect(runLocalRagTurn(input, bundle)).rejects.toThrow(/bundle\.vectors 为空/);
  });

  it("fixture 上返回占位 answer 与非空 citations", async () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const vectors = JSON.parse(
      readFileSync(path.join(dir, "../__fixtures__/vectors.small.json"), "utf8"),
    ) as SerializedMemoryVector[];
    const bundle: LocalKbBundle = {
      manifest: {
        version: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
        embeddingModel: "offline/stub",
        totalChunks: vectors.length,
        sources: ["_golden_fixture.pdf"],
      },
      vectors,
    };
    const input: LocalRagTurnInput = {
      userText: "文档里关于猫和狗以及居家饲养的关键点是什么？",
      history: [],
    };
    const out = await runLocalRagTurn(input, bundle);
    expect(out.answer).toBe(OFFLINE_STUB_REPLY.trim());
    expect(out.citations.length).toBeGreaterThan(0);
    expect(out.citations[0]).toMatchObject({
      index: 1,
      sourceFile: expect.any(String) as string,
      chunkIndex: expect.anything(),
      score: expect.any(Number) as number,
      preview80: expect.any(String) as string,
    });
  });
});
