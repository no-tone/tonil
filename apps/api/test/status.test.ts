import { SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /status", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("reports every registered app as up when probes succeed", async () => {
    const res = await SELF.fetch("https://api.no-tone.com/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      apps: Array<{ status: string }>;
      tailnet: { device: unknown };
    };
    expect(body.apps.length).toBeGreaterThan(0);
    expect(body.apps.every((app) => app.status === "up")).toBe(true);
    // No TAILSCALE_* vars are configured in the test environment, so the
    // tailnet lookup should short-circuit to null without an extra fetch.
    expect(body.tailnet.device).toBeNull();
  });
});
