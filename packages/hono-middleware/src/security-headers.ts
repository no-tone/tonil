import type { Env, MiddlewareHandler } from "hono";
import { type BuildSecurityHeadersOptions, buildSecurityHeaders } from "./core";
import { generateNonce } from "./nonce";

export type CspNonceEnv = Env & { Variables: { cspNonce: string } };

export type SecurityHeadersOptions = Omit<
  BuildSecurityHeadersOptions,
  "url" | "nonce"
>;

/**
 * Sets a CSP nonce on the context (readable via c.get("cspNonce")) and, after
 * the handler runs, applies the full baseline security-header set + a nonce'd
 * CSP built by ./core's buildSecurityHeaders - the same logic Astro apps use
 * directly in their own middleware.ts.
 */
export function securityHeaders(
  options: SecurityHeadersOptions = {},
): MiddlewareHandler<CspNonceEnv> {
  return async (c, next) => {
    const nonce = generateNonce();
    c.set("cspNonce", nonce);

    await next();

    const url = new URL(c.req.url);
    const { headers, csp } = buildSecurityHeaders({ ...options, url, nonce });

    c.res.headers.delete("Content-Security-Policy-Report-Only");

    const contentType = c.res.headers.get("Content-Type") || "";
    if (contentType.startsWith("text/html")) {
      c.res.headers.set("Content-Type", "text/html; charset=utf-8");
      c.res.headers.set("Cache-Control", "private, max-age=0, must-revalidate");
    }

    for (const [name, value] of Object.entries(headers)) {
      c.res.headers.set(name, value);
    }
    c.res.headers.set("Content-Security-Policy", csp);
  };
}
