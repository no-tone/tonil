import { describe, expect, it } from "vitest";
import { onRequest } from "../src/middleware";

// Minimal stand-in for Astro's MiddlewareHandler context — just enough of
// APIContext for this middleware's own logic (it never touches routing,
// props, etc).
function buildContext(url: string, init?: RequestInit) {
  return {
    request: new Request(url, init),
    locals: {} as { cspNonce?: string },
  };
}

const next = async () =>
  new Response("<html><body>ok</body></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });

describe("apps/web middleware", () => {
  it("sets a cspNonce on locals", async () => {
    const ctx = buildContext("https://no-tone.com/");
    await onRequest(ctx as never, next);
    expect(typeof ctx.locals.cspNonce).toBe("string");
    expect(ctx.locals.cspNonce.length).toBeGreaterThan(0);
  });

  it("301s www to the apex host, preserving path", async () => {
    const ctx = buildContext("https://www.no-tone.com/projects");
    const res = await onRequest(ctx as never, next);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://no-tone.com/projects");
  });

  it("serves a blanket-disallow robots.txt on the dev host", async () => {
    const ctx = buildContext("https://dev.no-tone.com/robots.txt");
    const res = await onRequest(ctx as never, next);
    expect(await res.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("serves the RFC 9727 API catalog pointing at api.no-tone.com/projects", async () => {
    const ctx = buildContext("https://no-tone.com/.well-known/api-catalog");
    const res = await onRequest(ctx as never, next);
    const body = await res.json();
    expect(body.linkset[0].anchor).toBe("https://api.no-tone.com/projects");
    expect(res.headers.get("Content-Type")).toContain(
      "application/linkset+json",
    );
  });

  it("serves the machine-readable markdown homepage for Accept: text/markdown", async () => {
    const ctx = buildContext("https://no-tone.com/", {
      headers: { Accept: "text/markdown" },
    });
    const res = await onRequest(ctx as never, next);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# no-tone");
  });

  it("passes browser requests for / through to the app", async () => {
    const ctx = buildContext("https://no-tone.com/", {
      headers: { Accept: "text/html" },
    });
    const res = await onRequest(ctx as never, next);
    expect(await res.text()).toBe("<html><body>ok</body></html>");
  });

  it("sets security headers and a CSP pointing report-uri at api.no-tone.com/csp-report", async () => {
    const ctx = buildContext("https://no-tone.com/");
    const res = await onRequest(ctx as never, next);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("report-uri https://api.no-tone.com/csp-report");
    expect(csp).toContain(`'nonce-${ctx.locals.cspNonce}'`);
  });

  it("relaxes script-src/style-src to unsafe-inline on localhost", async () => {
    const ctx = buildContext("http://localhost:4321/");
    const res = await onRequest(ctx as never, next);
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("tags dev-host responses with X-Robots-Tag", async () => {
    const ctx = buildContext("https://dev.no-tone.com/anything");
    const res = await onRequest(ctx as never, next);
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });
});
