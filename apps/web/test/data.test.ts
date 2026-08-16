import { describe, expect, it } from "vitest";
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
