import { describe, expect, it } from "vitest";
import { effectiveOfflineForTesting } from "./effectiveOffline.js";

describe("effectiveOfflineForTesting", () => {
  it("preferOffline 为 true 时恒为有效离线", () => {
    expect(
      effectiveOfflineForTesting({
        preferOffline: true,
        platform: "web",
        navigatorOnLine: true,
      }),
    ).toBe(true);
    expect(
      effectiveOfflineForTesting({
        preferOffline: true,
        platform: "native",
        netConnected: true,
      }),
    ).toBe(true);
  });

  it("Web：仅当 navigator.onLine === false 时因网络离线", () => {
    expect(
      effectiveOfflineForTesting({ preferOffline: false, platform: "web", navigatorOnLine: true }),
    ).toBe(false);
    expect(
      effectiveOfflineForTesting({ preferOffline: false, platform: "web", navigatorOnLine: false }),
    ).toBe(true);
    expect(effectiveOfflineForTesting({ preferOffline: false, platform: "web" })).toBe(false);
  });

  it("Native：仅当 netConnected === false 时因网络离线", () => {
    expect(
      effectiveOfflineForTesting({ preferOffline: false, platform: "native", netConnected: true }),
    ).toBe(false);
    expect(
      effectiveOfflineForTesting({ preferOffline: false, platform: "native", netConnected: false }),
    ).toBe(true);
    expect(effectiveOfflineForTesting({ preferOffline: false, platform: "native" })).toBe(false);
  });
});
