import { describe, expect, it } from "vitest";
import { OfflineStubInferenceProvider } from "../../api-core/src/providers/offline/stubInference.js";
import { OFFLINE_STUB_REPLY } from "./offlineStubReply.js";

describe("OFFLINE_STUB_REPLY", () => {
  it("与 OfflineStubInferenceProvider.chat 返回一致", async () => {
    const p = new OfflineStubInferenceProvider();
    const r = await p.chat([]);
    expect(OFFLINE_STUB_REPLY).toBe(r.content);
  });
});
