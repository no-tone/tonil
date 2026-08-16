import { SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GITHUB_REPOS = [
  {
    name: "tonil",
    html_url: "https://github.com/no-tone/tonil",
    stargazers_count: 5,
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("GET /projects", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(GITHUB_REPOS), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("proxies and simplifies the GitHub repo list", async () => {
    const res = await SELF.fetch("https://api.no-tone.com/projects");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ name: string }>;
    expect(body).toEqual([
      expect.objectContaining({ name: "tonil", stars: 5, forks: 0 }),
    ]);
  });

  it("sets Access-Control-Allow-Origin for a trusted cross-origin caller", async () => {
    const res = await SELF.fetch("https://api.no-tone.com/projects", {
      headers: { Origin: "https://no-tone.com" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://no-tone.com",
    );
  });

  it("omits Access-Control-Allow-Origin for an untrusted origin", async () => {
    const res = await SELF.fetch("https://api.no-tone.com/projects", {
      headers: { Origin: "https://evil.example.com" },
    });
    // The global cors() middleware doesn't reject the request outright — it
    // just withholds the header, which is what makes the browser (not this
    // server) block the response from being read cross-origin.
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("sets Cross-Origin-Resource-Policy: cross-origin (this API is deliberately multi-origin)", async () => {
    const res = await SELF.fetch("https://api.no-tone.com/projects");
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe(
      "cross-origin",
    );
  });
});
