import { afterEach, describe, expect, it, vi } from "vitest";
import { mapApiReposToProjects } from "../src/scripts/desktop/data";

describe("mapApiReposToProjects", () => {
  it("returns an empty array for a non-array payload", () => {
    expect(mapApiReposToProjects(null)).toEqual([]);
    expect(mapApiReposToProjects({})).toEqual([]);
  });

  it("drops forks and archived repos", () => {
    const raw = [
      { name: "a", url: "https://github.com/no-tone/a", isFork: true },
      { name: "b", url: "https://github.com/no-tone/b", isArchived: true },
      { name: "c", url: "https://github.com/no-tone/c" },
    ];
    expect(mapApiReposToProjects(raw).map((p) => p.name)).toEqual(["c"]);
  });

  it("drops entries without a name", () => {
    expect(
      mapApiReposToProjects([{ url: "https://github.com/no-tone/x" }]),
    ).toEqual([]);
  });

  it("maps fields, deriving year from updatedAt and defaulting description", () => {
    const [project] = mapApiReposToProjects([
      {
        name: "pyrowatch",
        url: "https://github.com/no-tone/pyrowatch",
        language: "Astro",
        updatedAt: "2024-05-01T00:00:00Z",
        stars: 3,
        topics: ["data-viz"],
      },
    ]);
    expect(project).toMatchObject({
      name: "pyrowatch",
      description: "—",
      language: "Astro",
      year: "2024",
      stars: 3,
      topics: ["data-viz"],
      url: "https://github.com/no-tone/pyrowatch",
      homepage: "",
    });
  });

  it("treats language 'Other' as unset", () => {
    const [project] = mapApiReposToProjects([
      { name: "x", url: "https://github.com/no-tone/x", language: "Other" },
    ]);
    expect(project.language).toBe("");
  });

  it("falls back to a GitHub Pages homepage when hasPages is set and homepage is blank", () => {
    const [project] = mapApiReposToProjects([
      {
        name: "pyrowatch",
        url: "https://github.com/no-tone/pyrowatch",
        hasPages: true,
      },
    ]);
    expect(project.homepage).toBe("https://no-tone.github.io/pyrowatch/");
  });

  it("prefers an explicit homepage over the GitHub Pages fallback", () => {
    const [project] = mapApiReposToProjects([
      {
        name: "pyrowatch",
        url: "https://github.com/no-tone/pyrowatch",
        hasPages: true,
        homepage: "https://example.com",
      },
    ]);
    expect(project.homepage).toBe("https://example.com");
  });
});

describe("fetchRepos", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it("caches a successful fetch — a second call doesn't hit the network again", async () => {
    vi.resetModules();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([{ name: "a", url: "https://github.com/no-tone/a" }]),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchRepos } = await import("../src/scripts/desktop/data");

    const first = await fetchRepos();
    const second = await fetchRepos();

    expect(first.live).toBe(true);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("doesn't cache a failed fetch, so the next call retries", async () => {
    vi.resetModules();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ name: "a", url: "https://github.com/no-tone/a" }]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchRepos } = await import("../src/scripts/desktop/data");

    const first = await fetchRepos();
    expect(first.live).toBe(false);

    const second = await fetchRepos();
    expect(second.live).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
