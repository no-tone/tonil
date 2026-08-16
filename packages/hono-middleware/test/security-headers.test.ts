import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "../src/security-headers";

function buildApp() {
  const app = new Hono();
  app.use(securityHeaders({ connectSrc: ["https://api.github.com"] }));
  app.get("/", (c) => c.text("ok"));
  return app;
}

describe("securityHeaders", () => {
  it("sets a nonce'd CSP and baseline security headers in production", async () => {
    const res = await buildApp().request("https://example.com/");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toContain("connect-src 'self' https://api.github.com");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(res.headers.get("Strict-Transport-Security")).toBeTruthy();
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("relaxes CSP and skips HSTS on configured dev hostnames", async () => {
    const res = await buildApp().request("http://localhost/");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(res.headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("forces private no-cache on HTML responses (they carry a per-request nonce)", async () => {
    const app = new Hono();
    app.use(securityHeaders());
    app.get("/", (c) => c.html("<p>hi</p>"));
    const res = await app.request("https://example.com/");
    expect(res.headers.get("Cache-Control")).toBe(
      "private, max-age=0, must-revalidate",
    );
  });
});
