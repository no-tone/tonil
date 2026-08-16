import { type Context, Hono } from "hono";
import type { AppEnv } from "../env";
import {
  fetchProjects,
  type ProjectsCacheState,
  type ProjectsSnapshot,
} from "../services/projects-cache";

const BROWSER_TTL_SECONDS = 300;
const EDGE_TTL_SECONDS = 900;
const LAST_UPDATED_HEADER = "x-tonil-last-updated";

// CORS (Access-Control-Allow-Origin, Vary) and Cross-Origin-Resource-Policy
// are both handled once for the whole API in src/index.ts — this route used
// to also reject any cross-origin request outright (origin !== same-origin
// → 403), which made sense when no-tone.com served this route itself, but
// now that apps/web and apps/api are deliberately different origins, that
// check was rejecting the site's own legitimate requests. Trust the
// app-level CORS allowlist instead of duplicating a second, stricter one
// here.
function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

export const projectsRoute = new Hono<AppEnv>();

projectsRoute.get("/", async (c) => {
  const { snapshot, cacheState } = await fetchProjects({
    githubToken: c.env.GITHUB_TOKEN,
    forceRevalidate: c.req.header("x-tonil-revalidate") === "1",
    onUpstreamError: (details) =>
      console.warn("[projects-api] upstream_failed", details),
  });

  return respond(c, snapshot, cacheState);
});

function respond(
  c: Context<AppEnv>,
  snapshot: ProjectsSnapshot,
  cacheState: ProjectsCacheState,
) {
  const extra: Record<string, string> = {
    [LAST_UPDATED_HEADER]: snapshot.lastUpdated,
    "X-Tonil-Cache": cacheState,
  };
  if (cacheState === "stale" || cacheState === "memory-stale") {
    extra.Warning = '110 - "Response is stale"';
  }
  if (cacheState === "unavailable") {
    return c.body(snapshot.body, 200, {
      ...buildHeaders({
        "Cache-Control": "no-store",
        "X-Tonil-Cache": cacheState,
      }),
    });
  }
  const headers = buildHeaders(extra);
  if (snapshot.etag) headers.ETag = snapshot.etag;
  return c.body(snapshot.body, 200, headers);
}
