import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchServerStatuses } from "../src/scripts/status-client";

describe("fetchServerStatuses", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("returns empty results when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const result = await fetchServerStatuses(100);
    expect(result.apps.size).toBe(0);
    expect(result.tailnetDeviceOnline).toBeNull();
  });

  it("returns empty results when the fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const result = await fetchServerStatuses(100);
    expect(result.apps.size).toBe(0);
    expect(result.tailnetDeviceOnline).toBeNull();
  });

  it("parses the apps map and tailnet device status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              apps: [
                { href: "https://a.example.com", status: "up" },
                { href: "https://b.example.com", status: "down" },
              ],
              tailnet: { device: { online: true } },
            }),
            { status: 200 },
          ),
      ),
    );
    const result = await fetchServerStatuses(100);
    expect(result.apps.get("https://a.example.com")).toBe("up");
    expect(result.apps.get("https://b.example.com")).toBe("down");
    expect(result.tailnetDeviceOnline).toBe(true);
  });
});
