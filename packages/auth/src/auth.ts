import { dash } from "@better-auth/infra";
import { type BetterAuthOptions, betterAuth } from "better-auth";

export interface AuthEnv {
  /** Cloudflare D1 binding — Better Auth detects a D1Database and uses it directly, no ORM needed. */
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  /** e.g. "https://api.no-tone.com" in production, unset in local dev. */
  BETTER_AUTH_URL?: string;
  /** Better Auth Infrastructure dashboard key. Unset in local dev/CI so the
   *  dash() plugin stays off and nothing calls out to that third-party API. */
  BETTER_AUTH_API_KEY?: string;
}

/**
 * The frontends allowed to call this API's `/api/auth/*` routes and (via
 * apps/api's CORS config, which imports this same list) the rest of the
 * API. Shared rather than duplicated so the two can't drift out of sync.
 */
export const TRUSTED_ORIGINS = [
  "https://no-tone.com",
  "https://www.no-tone.com",
  "https://apps.no-tone.com",
  // Pre-cutover dashboard preview URL — remove once apps.no-tone.com is the
  // dashboard's real custom domain (see docs/deployment.md).
  "https://dashboard.no-tone.workers.dev",
];
const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Email/password only for now (per the project's current scope — no
 * Google/Apple/passkeys yet). Schema lives at `apps/api/db/schema.sql`,
 * regenerated via `apps/api/scripts/generate-schema.ts` (not the published
 * `@better-auth/cli`, which predates D1 support) and applied with
 * `wrangler d1 execute tonil-auth --remote --file=db/schema.sql`.
 */
export function createAuth(env: AuthEnv) {
  // apps/dashboard lives on a different origin than this API (api.no-tone.com
  // vs. apps.no-tone.com), so the session cookie needs to be shared across
  // *.no-tone.com — but only when actually serving from that domain; setting
  // a `.no-tone.com` cookie domain while running on localhost would just
  // make browsers silently drop the cookie.
  const isProdDomain = env.BETTER_AUTH_URL?.endsWith(".no-tone.com") ?? false;

  const options: BetterAuthOptions = {
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: (request) => {
      const origin = request?.headers.get("origin");
      return origin && LOCAL_DEV_ORIGIN.test(origin)
        ? [...TRUSTED_ORIGINS, origin]
        : TRUSTED_ORIGINS;
    },
    advanced: isProdDomain
      ? { crossSubDomainCookies: { enabled: true, domain: ".no-tone.com" } }
      : undefined,
    emailAndPassword: {
      enabled: true,
    },
    plugins: env.BETTER_AUTH_API_KEY
      ? [dash({ apiKey: env.BETTER_AUTH_API_KEY })]
      : [],
  };
  return betterAuth(options);
}

export type Auth = ReturnType<typeof createAuth>;
