import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearProjectsCache, loadProjects } from "../src/services/projects";

const ONE_REPO = [
  {
    name: "tonil",
    url: "https://github.com/no-tone/tonil",
    homepage: "",
    language: "TypeScript",
    description: "",
    topics: [],
    isFork: false,
    isArchived: false,
    stars: 0,
    updatedAt: "2026-08-01T00:00:00Z",
  },
];

function respondWith(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  } as unknown as Response);
}

describe("loadProjects", () => {
  beforeEach(() => {
    clearProjectsCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("drops forks and archived repos, newest first", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith([
        { ...ONE_REPO[0], name: "old", updatedAt: "2020-01-01T00:00:00Z" },
        { ...ONE_REPO[0], name: "aFork", isFork: true },
        { ...ONE_REPO[0], name: "archived", isArchived: true },
        { ...ONE_REPO[0], name: "new", updatedAt: "2026-08-01T00:00:00Z" },
      ]),
    );
    const { repos, ok } = await loadProjects();
    expect(ok).toBe(true);
    expect(repos.map((r) => r.name)).toEqual(["new", "old"]);
  });

  it("serves the second call from cache without touching the network", async () => {
    // The point of the cache: a view transition to /work is a real request
    // for the page, so without this every tab click called the API.
    const fetchMock = respondWith(ONE_REPO);
    vi.stubGlobal("fetch", fetchMock);

    await loadProjects();
    await loadProjects();
    await loadProjects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again once the entry has expired", async () => {
    const fetchMock = respondWith(ONE_REPO);
    vi.stubGlobal("fetch", fetchMock);

    await loadProjects();
    vi.advanceTimersByTime(16 * 60 * 1000);
    await loadProjects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure", async () => {
    // Otherwise one upstream blip costs every visitor the next fifteen
    // minutes of an empty page.
    const failing = respondWith(null, false);
    vi.stubGlobal("fetch", failing);
    expect((await loadProjects()).ok).toBe(false);

    const succeeding = respondWith(ONE_REPO);
    vi.stubGlobal("fetch", succeeding);
    expect((await loadProjects()).ok).toBe(true);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it("reports failure rather than throwing when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loadProjects()).toEqual({ repos: [], ok: false });
  });
});
