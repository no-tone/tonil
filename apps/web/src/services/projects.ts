/* Fetches the project list for /work.

   Server-side, at request time, rather than in the browser: the list is the
   page's content, so it should be in the HTML a crawler receives and should
   not arrive after first paint and reflow the page. apps/api already caches
   the GitHub response at the edge, so this is a cheap call to a neighbouring
   Worker rather than a round trip to GitHub.

   Note that `/projects` returns *already simplified* repositories - apps/api
   runs @repo/content's `simplifyRepos` before caching. Running it again here
   silently returns nothing, because the second pass looks for the raw GitHub
   field names (`html_url`, `fork`) that the first pass has already renamed.
   Parse against the response's own schema instead.

   A failure is not an error page. The rest of /work is still worth
   reading, so an outage degrades to a note and a link to GitHub. */

import { fetchWithTimeout } from "@repo/content";
import { type Project, projectsResponseSchema } from "@repo/validation";

const PROJECTS_URL = "https://api.no-tone.com/projects";
const TIMEOUT_MS = 4000;
/**
 * How long a fetched list is reused without asking again.
 *
 * A Workers isolate is kept alive between requests, so a module-level cache
 * survives them - this is the same trick apps/api's projects-cache uses for
 * its own upstream. It matters because every navigation to /work is a real
 * request for the page: view transitions fetch the new document, so without
 * this, clicking between tabs called the API once per click.
 *
 * Matched to the API's own 15-minute edge TTL. Asking more often than the
 * data can change buys nothing.
 */
const MEMO_TTL_MS = 15 * 60 * 1000;

export interface ProjectsResult {
  repos: Project[];
  /** False when the API could not be reached - the page says so rather than showing nothing. */
  ok: boolean;
}

let memo: { at: number; result: ProjectsResult } | null = null;

/** Drops the cached list. For tests; nothing in the app needs it. */
export function clearProjectsCache(): void {
  memo = null;
}

/**
 * Repositories to show, newest first.
 *
 * Forks and archived repos are dropped: they are not work, they are history,
 * and a list padded with them says less than a short honest one.
 */
export async function loadProjects(): Promise<ProjectsResult> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.result;

  try {
    const response = await fetchWithTimeout(PROJECTS_URL, TIMEOUT_MS, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { repos: [], ok: false };

    const parsed = projectsResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { repos: [], ok: false };

    const repos = parsed.data
      .filter((repo) => !repo.isFork && !repo.isArchived)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    const result: ProjectsResult = { repos, ok: true };
    memo = { at: Date.now(), result };
    return result;
  } catch {
    // A failure is not cached: the next visitor should get a fresh attempt
    // rather than inherit fifteen minutes of someone else's timeout.
    return { repos: [], ok: false };
  }
}
