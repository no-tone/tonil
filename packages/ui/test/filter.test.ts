import { describe, expect, it } from "vitest";
import { matchesFilter } from "../src/site/filter.js";

describe("matchesFilter", () => {
  const tile = { name: "Portainer", tags: "Ops,Self-Hosted" };

  it("matches everything when query and tag are empty", () => {
    expect(matchesFilter(tile, "", "")).toBe(true);
  });

  it("matches by case-insensitive substring of the name", () => {
    expect(matchesFilter(tile, "port", "")).toBe(true);
    expect(matchesFilter(tile, "PORT", "")).toBe(true);
    expect(matchesFilter(tile, "immich", "")).toBe(false);
  });

  it("matches by tag membership in the comma-joined tag string", () => {
    expect(matchesFilter(tile, "", "Ops")).toBe(true);
    expect(matchesFilter(tile, "", "Media")).toBe(false);
  });

  it("requires both the name and tag filters to match", () => {
    expect(matchesFilter(tile, "port", "Ops")).toBe(true);
    expect(matchesFilter(tile, "port", "Media")).toBe(false);
  });

  it("trims whitespace from both filters", () => {
    expect(matchesFilter(tile, "  port  ", "  Ops  ")).toBe(true);
  });
});
