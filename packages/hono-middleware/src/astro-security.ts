import type { APIContext, MiddlewareNext } from "astro";
import { type BuildSecurityHeadersOptions, buildSecurityHeaders } from "./core";
import { generateNonce } from "./nonce";

export type AstroSecurityOptions = Omit<
  BuildSecurityHeadersOptions,
  "url" | "nonce"
>;

// Deliberately narrower than Astro's own `MiddlewareHandler` (which allows a
// `void` return, for middleware that only mutates locals and falls through).
// This one always returns a Response, so callers that compose it (see
// apps/web/src/middleware.ts) can rely on that without re-widening back to
// `void | Response`.
export type AstroSecurityMiddleware = (
  context: APIContext,
  next: MiddlewareNext,
) => Promise<Response>;

/**
 * The shared half of every app's Astro `src/middleware.ts` in this monorepo:
 * generate a per-request nonce, stash it on `context.locals.cspNonce` (which
 * `@repo/ui`'s BaseHead.astro reads), then after the page renders, apply the
 * baseline security headers + nonce'd CSP from `buildSecurityHeaders`.
 *
 * Each app still writes its own `middleware.ts` for anything that isn't
 * shared (www-redirect, dev-robots, the RFC 9727 catalog, markdown
 * negotiation) — call this first, then layer that app-specific handling
 * around it, e.g.:
 *
 * ```ts
 * const security = createAstroSecurityMiddleware({ connectSrc: [...] });
 * export const onRequest: MiddlewareHandler = async (context, next) => {
 *   // app-specific short-circuits (redirects, dev-robots, etc.) here, using
 *   // context.locals.cspNonce if needed — call security(context, next) to
 *   // run the shared nonce+header logic around the rest.
 *   return security(context, next);
 * };
 * ```
 */
export function createAstroSecurityMiddleware(
  options: AstroSecurityOptions = {},
): AstroSecurityMiddleware {
  return async (context, next) => {
    const nonce = generateNonce();
    context.locals.cspNonce = nonce;

    const downstreamResponse = await next();
    // Defensive copy: some Response constructors (e.g. Response.redirect())
    // produce responses with immutable headers, and this middleware needs to
    // mutate them.
    const response = new Response(downstreamResponse.body, downstreamResponse);
    response.headers.delete("Content-Security-Policy-Report-Only");

    // HTML carries a per-request nonce, so it must never be served from a
    // shared cache — a cached response's nonce won't match any subsequent
    // request's freshly generated one.
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.startsWith("text/html")) {
      response.headers.set("Content-Type", "text/html; charset=utf-8");
      response.headers.set(
        "Cache-Control",
        "private, max-age=0, must-revalidate",
      );
    }

    const url = new URL(context.request.url);
    const { headers, csp } = buildSecurityHeaders({ ...options, url, nonce });
    for (const [name, value] of Object.entries(headers)) {
      response.headers.set(name, value);
    }
    response.headers.set("Content-Security-Policy", csp);

    return response;
  };
}
