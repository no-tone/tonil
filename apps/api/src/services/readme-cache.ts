const GITHUB_USER = "no-tone";
const GITHUB_API_ORIGIN = "https://api.github.com";
const CACHE_KEY_PREFIX = "https://readme-api.tonil.internal/v1/";
const EDGE_TTL_SECONDS = 3600;
const CACHED_AT_HEADER = "x-tonil-cached-at";

type ReadmeCacheState = "hit" | "miss" | "updated" | "stale" | "absent";

export interface ReadmeResult {
  /** Rendered HTML fragment, or null when the repo has no README. */
  html: string | null;
  cacheState: ReadmeCacheState;
}

// GitHub repo names allow alphanumerics, hyphen, underscore and period. The
// name is interpolated into an upstream URL, so validate it rather than trust
// it: a bare encodeURIComponent still lets "." / ".." through, and anything
// outside this set has no business reaching api.github.com.
const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function isValidRepoName(name: string): boolean {
  return REPO_NAME_PATTERN.test(name) && name !== "." && name !== "..";
}

interface FetchReadmeOptions {
  githubToken?: string;
  onUpstreamError?: (details: { error: string; hasStale: boolean }) => void;
}

function getEdgeCache(): Cache | undefined {
  return (globalThis as { caches?: { default: Cache } }).caches?.default;
}

function readCachedAtMs(res: Response): number {
  const parsed = Number(res.headers.get(CACHED_AT_HEADER));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isFresh(cachedAtMs: number, nowMs: number): boolean {
  return cachedAtMs > 0 && nowMs - cachedAtMs < EDGE_TTL_SECONDS * 1000;
}

/**
 * Fetches a repo's README as a rendered HTML fragment, cached at the edge.
 *
 * apps/web used to fetch this straight from the visitor's browser, which meant
 * every visitor spent GitHub's 60-requests/hour unauthenticated per-IP budget,
 * nothing was cached, and any GitHub hiccup surfaced in the console as an
 * opaque CORS error (GitHub omits Access-Control-Allow-Origin on its own 5xx
 * responses). Proxying here instead reuses the GITHUB_TOKEN secret and the
 * same edge-cache approach as projects-cache.ts.
 */
export async function fetchReadmeHtml(
  name: string,
  options: FetchReadmeOptions = {},
): Promise<ReadmeResult> {
  const cache = getEdgeCache();
  const cacheKey = new Request(
    `${CACHE_KEY_PREFIX}${encodeURIComponent(name)}`,
  );
  const cached = cache
    ? ((await cache.match(cacheKey)) ?? undefined)
    : undefined;

  let staleHtml: string | null = null;
  if (cached) {
    staleHtml = await cached.clone().text();
    if (isFresh(readCachedAtMs(cached), Date.now())) {
      return { html: staleHtml, cacheState: "hit" };
    }
  }

  try {
    const upstream = await fetch(
      `${GITHUB_API_ORIGIN}/repos/${GITHUB_USER}/${encodeURIComponent(name)}/readme`,
      {
        headers: {
          "User-Agent": "tonil-api",
          Accept: "application/vnd.github.html+json",
          ...(options.githubToken
            ? { Authorization: `Bearer ${options.githubToken}` }
            : {}),
        },
      },
    );

    // A repo with no README is a legitimate answer, not a failure — don't fall
    // back to a stale copy for it.
    if (upstream.status === 404) return { html: null, cacheState: "absent" };
    if (!upstream.ok) throw new Error(`upstream-status-${upstream.status}`);

    const html = await upstream.text();
    if (cache) {
      await cache.put(
        cacheKey,
        new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            [CACHED_AT_HEADER]: String(Date.now()),
          },
        }),
      );
    }
    return { html, cacheState: staleHtml === null ? "miss" : "updated" };
  } catch (error) {
    options.onUpstreamError?.({
      error: error instanceof Error ? error.message : "unknown-error",
      hasStale: staleHtml !== null,
    });
    // A GitHub outage shouldn't blank a README we already have.
    if (staleHtml !== null) return { html: staleHtml, cacheState: "stale" };
    return { html: null, cacheState: "absent" };
  }
}
