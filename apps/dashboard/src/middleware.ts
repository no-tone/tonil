import { SELF_HOSTED_APPS } from "@repo/content";
import {
  type AstroSecurityMiddleware,
  createAstroSecurityMiddleware,
} from "@repo/hono-middleware/astro-security";

// main-menu had no middleware at all — access was delegated entirely to
// Cloudflare Zero Trust in front of the Worker (see its README). This app
// now gates itself behind Better Auth instead (see hasValidSession below),
// plus the baseline nonce'd CSP + security-header set every app in this
// monorepo shares, which is also a hard requirement for BaseHead.astro — it
// reads Astro.locals.cspNonce to nonce its inline theme-bootstrap script.
const security = createAstroSecurityMiddleware({
  devHostnames: ["localhost", "127.0.0.1"],
  connectSrc: [
    // status-client.ts and auth-client.ts both fetch apps/api client-side.
    "https://api.no-tone.com",
    // client-probe.ts pings each tile's own origin directly from the
    // visitor's browser (see its own comment for why) — every app in the
    // registry needs to be allowed, derived here so this can't drift out of
    // sync with SELF_HOSTED_APPS the way two hand-maintained lists would.
    ...new Set(SELF_HOSTED_APPS.map((app) => new URL(app.href).origin)),
  ],
});

const AUTH_ORIGIN = "https://api.no-tone.com";
const PUBLIC_PATHS = new Set(["/login"]);

/**
 * Server-to-server session check (not a browser fetch, so no CORS involved):
 * forwards this request's own Cookie header to apps/api's Better Auth
 * instance. The session cookie is shared across *.no-tone.com via
 * packages/auth's crossSubDomainCookies config — see its comment for why
 * that only takes effect on the real domain, not this workers.dev preview.
 */
async function hasValidSession(request: Request): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_ORIGIN}/api/auth/get-session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (!res.ok) return false;
    return (await res.json()) !== null;
  } catch {
    return false;
  }
}

export const onRequest: AstroSecurityMiddleware = async (context, next) => {
  const url = new URL(context.request.url);

  if (
    !PUBLIC_PATHS.has(url.pathname) &&
    !(await hasValidSession(context.request))
  ) {
    const redirectTarget = new URL("/login", url);
    if (url.pathname !== "/") {
      redirectTarget.searchParams.set("redirect", url.pathname);
    }
    return Response.redirect(redirectTarget.toString(), 302);
  }

  return security(context, next);
};
