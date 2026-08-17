import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("app-wide middleware", () => {
  it("serves the RFC 9727 api catalog", async () => {
    const res = await SELF.fetch(
      "https://api.no-tone.com/.well-known/api-catalog",
    );
    expect(res.headers.get("Content-Type")).toBe(
      "application/linkset+json; charset=utf-8",
    );
    const body = (await res.json()) as { linkset: { anchor: string }[] };
    expect(body.linkset.map((entry) => entry.anchor)).toEqual([
      "https://api.no-tone.com/projects",
      "https://api.no-tone.com/projects/{repo}/readme",
      "https://api.no-tone.com/status",
      "https://api.no-tone.com/csp-report",
      "https://api.no-tone.com/info/{slug}",
    ]);
  });

  it("applies the nonce'd CSP and baseline security headers to every response", async () => {
    const res = await SELF.fetch("https://api.no-tone.com/info/no-tone");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("renders unknown routes' 404s as application/problem+json, with the shared security headers", async () => {
    const res = await SELF.fetch("https://api.no-tone.com/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
