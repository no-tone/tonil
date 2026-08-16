import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyWithJwks } from "hono/jwt";

export interface CloudflareAccessOptions {
  /** e.g. "no-tone.cloudflareaccess.com" */
  teamDomain: string;
  /** The protected Access application's AUD tag (Access → Applications → that app → Overview). */
  aud: string;
  /** @default "Cf-Access-Jwt-Assertion" */
  headerName?: string;
}

/**
 * Verifies a Cloudflare Access JWT against the team's JWKS (hono/jwt's
 * verifyWithJwks — Hono's already a dependency everywhere, no need for a
 * separate JWT library). Reads the JWT from a header rather than Access's
 * own CF_Authorization cookie: this is for routes reached via a
 * server-to-server forward (see apps/dashboard's api/status.ts) from an app
 * that's already behind its own Access policy on a different hostname, not
 * directly behind Access itself. Throws a 401 if the header is missing or
 * the token doesn't verify.
 */
export function requireCloudflareAccess(
  options: CloudflareAccessOptions,
): MiddlewareHandler {
  const headerName = options.headerName ?? "Cf-Access-Jwt-Assertion";
  const issuer = `https://${options.teamDomain}`;
  const jwksUri = `${issuer}/cdn-cgi/access/certs`;

  return async (c, next) => {
    const token = c.req.header(headerName);
    if (!token) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    try {
      await verifyWithJwks(token, {
        jwks_uri: jwksUri,
        verification: { iss: issuer, aud: options.aud },
        allowedAlgorithms: ["RS256"],
      });
    } catch {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    await next();
  };
}
