import { describe, expect, it } from "vitest";
import { createAstroSecurityMiddleware } from "../src/astro-security";

function buildContext(url: string) {
  return {
    request: new Request(url),
    locals: {} as { cspNonce?: string },
  };
}

describe("createAstroSecurityMiddleware", () => {
  it("sets a cspNonce on locals", async () => {
    const middleware = createAstroSecurityMiddleware();
    const ctx = buildContext("https://example.com/");
    await middleware(ctx as never, async () => new Response("ok"));
    expect(typeof ctx.locals.cspNonce).toBe("string");
    expect(ctx.locals.cspNonce?.length).toBeGreaterThan(0);
  });

  it("applies the nonce'd CSP and baseline security headers", async () => {
    const middleware = createAstroSecurityMiddleware({
      connectSrc: ["https://api.example.com"],
    });
    const ctx = buildContext("https://example.com/");
    const res = await middleware(ctx as never, async () => new Response("ok"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain(`'nonce-${ctx.locals.cspNonce}'`);
    expect(csp).toContain("connect-src 'self' https://api.example.com");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("strips any upstream Content-Security-Policy-Report-Only header", async () => {
    const middleware = createAstroSecurityMiddleware();
    const ctx = buildContext("https://example.com/");
    const res = await middleware(
      ctx as never,
      async () =>
        new Response("ok", {
          headers: {
            "Content-Security-Policy-Report-Only": "default-src 'none'",
          },
        }),
    );
    expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
  });

  it("forces private no-cache on text/html responses (they carry a per-request nonce)", async () => {
    const middleware = createAstroSecurityMiddleware();
    const ctx = buildContext("https://example.com/");
    const res = await middleware(
      ctx as never,
      async () =>
        new Response("<p>hi</p>", { headers: { "Content-Type": "text/html" } }),
    );
    expect(res.headers.get("Cache-Control")).toBe(
      "private, max-age=0, must-revalidate",
    );
  });

  it("leaves non-HTML responses' cache headers alone", async () => {
    const middleware = createAstroSecurityMiddleware();
    const ctx = buildContext("https://example.com/");
    const res = await middleware(
      ctx as never,
      async () =>
        new Response("{}", {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60",
          },
        }),
    );
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  it("still applies headers even when next() returns a Response with immutable headers", async () => {
    // Response.redirect() produces a Response whose headers throw on .set() -
    // this is exactly the case the defensive `new Response(body, init)` copy
    // in the implementation exists for.
    const middleware = createAstroSecurityMiddleware();
    const ctx = buildContext("https://example.com/");
    const res = await middleware(ctx as never, async () =>
      Response.redirect("https://example.com/elsewhere", 302),
    );
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });
});
