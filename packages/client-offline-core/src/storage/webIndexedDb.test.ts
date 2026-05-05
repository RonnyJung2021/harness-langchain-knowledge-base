import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LocalKbBundle, SerializedMemoryVector } from "@kb-rag/shared";
import { chunkSerializedVectors, createWebIndexedDbKbBundleStore } from "./webIndexedDb.js";

describe("chunkSerializedVectors", () => {
  it("大向量会拆成多块", () => {
    const dim = 1024;
    const vec = (i: number): SerializedMemoryVector => ({
      content: `c${String(i)}`,
      embedding: Array.from({ length: dim }, (_, j) => ((i + j) % 97) / 97),
      metadata: { source: "t.pdf", chunkIndex: i },
    });
    const vectors = Array.from({ length: 200 }, (_, i) => vec(i));
    const chunks = chunkSerializedVectors(vectors);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat().length).toBe(vectors.length);
  });
});

describe("createWebIndexedDbKbBundleStore", () => {
  it("save / load / clear 往返", async () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const vectors = JSON.parse(
      readFileSync(path.join(dir, "../../__fixtures__/vectors.small.json"), "utf8"),
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

    const store = createWebIndexedDbKbBundleStore();
    await store.clear();
    expect(await store.load()).toBeNull();

    await store.save(bundle);
    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.manifest).toEqual(bundle.manifest);
    expect(loaded!.vectors.length).toBe(bundle.vectors.length);
    expect(loaded!.vectors[0]!.embedding).toEqual(bundle.vectors[0]!.embedding);

    await store.clear();
    expect(await store.load()).toBeNull();
  });
});
