import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../src/http";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the response when it arrives before the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
    const res = await fetchWithTimeout("https://example.com", 1000);
    expect(res.status).toBe(200);
  });

  it("passes through init options alongside the abort signal", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL, _init?: RequestInit) => new Response("ok"),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchWithTimeout("https://example.com", 1000, { cache: "no-store" });
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const init = call?.[1];
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts and rejects once the timeout elapses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        });
      }),
    );
    await expect(fetchWithTimeout("https://example.com", 5)).rejects.toThrow();
  });
});
