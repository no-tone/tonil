import { NO_TONE_INFO } from "@repo/content";
import { createAstroSecurityMiddleware } from "@repo/hono-middleware/astro-security";
import { buildApiCatalogBody } from "@repo/hono-middleware/core";
import type { MiddlewareHandler } from "astro";

// Native Astro middleware: this app is its own Cloudflare Worker (separate
// from apps/api's Hono app), so it can't use the Hono middlewares in
// @repo/hono-middleware directly. The nonce-generation + security-header
// application shared with apps/dashboard lives in createAstroSecurityMiddleware
// (@repo/hono-middleware/astro-security); everything below is specific to
// this app — www-redirect, dev robots.txt, the RFC 9727 catalog, and
// markdown content-negotiation on the homepage.

const DEV_HOSTNAME = "dev.no-tone.com";
const DEV_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";
const DEV_ROBOTS_TAG = "noindex, nofollow, noarchive, nosnippet";
const API_ORIGIN = "https://api.no-tone.com";
// Centralized in apps/api now — this app no longer serves its own CSP-report
// endpoint.
const CSP_REPORT_URL = `${API_ORIGIN}/csp-report`;

const API_CATALOG_BODY = buildApiCatalogBody([
  { href: `${API_ORIGIN}/projects` },
]);

const LINKS = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</llms.txt>; rel="describedby"; type="text/markdown"',
];

const security = createAstroSecurityMiddleware({
  devHostnames: ["localhost", "127.0.0.1"],
  // api.no-tone.com only: scripts/desktop/data.ts fetches both /projects and
  // per-repo READMEs from there client-side, cross-origin. api.github.com used
  // to be listed for the README fetch, which now goes through apps/api instead
  // (see fetchReadme) — nothing in this app talks to GitHub directly anymore.
  connectSrc: [API_ORIGIN],
  reportPath: CSP_REPORT_URL,
  links: LINKS,
});

export const onRequest: MiddlewareHandler = async (context, next) => {
  const requestUrl = new URL(context.request.url);

  if (requestUrl.hostname === "www.no-tone.com") {
    const target = new URL(requestUrl);
    target.hostname = "no-tone.com";
    return Response.redirect(target.toString(), 301);
  }

  const isDevHost = requestUrl.hostname === DEV_HOSTNAME;
  if (isDevHost && requestUrl.pathname === "/robots.txt") {
    return new Response(DEV_ROBOTS_TXT, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": DEV_ROBOTS_TAG,
      },
    });
  }

  // RFC 9727 API catalog (agent discovery for the public API on api.no-tone.com).
  if (requestUrl.pathname === "/.well-known/api-catalog") {
    return new Response(API_CATALOG_BODY, {
      status: 200,
      headers: {
        "Content-Type": "application/linkset+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Markdown content negotiation: agents that ask for text/markdown get a
  // machine-readable homepage; browsers (which don't) still get the app.
  const accept = context.request.headers.get("Accept") || "";
  if (requestUrl.pathname === "/" && accept.includes("text/markdown")) {
    return new Response(NO_TONE_INFO.markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
        Vary: "Accept",
      },
    });
  }

  const response = await security(context, next);
  if (isDevHost) {
    response.headers.set("X-Robots-Tag", DEV_ROBOTS_TAG);
  }
  return response;
};
