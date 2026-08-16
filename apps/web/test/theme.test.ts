import { beforeEach, describe, expect, it } from "vitest";
import {
  currentTheme,
  resolveInitialSigId,
} from "../src/scripts/desktop/theme";

describe("resolveInitialSigId", () => {
  it("keeps a stored id that matches a known signature", () => {
    expect(resolveInitialSigId("blue")).toBe("blue");
  });

  it("falls back to mono when nothing is stored", () => {
    expect(resolveInitialSigId(null)).toBe("mono");
  });

  it("falls back to mono when the stored id no longer exists", () => {
    expect(resolveInitialSigId("retired-signature")).toBe("mono");
  });
});

describe("currentTheme", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("treats an explicit light dataset as light", () => {
    document.documentElement.dataset.theme = "light";
    expect(currentTheme()).toBe("light");
  });

  it("defaults to dark for anything else", () => {
    document.documentElement.dataset.theme = "dark";
    expect(currentTheme()).toBe("dark");
    delete document.documentElement.dataset.theme;
    expect(currentTheme()).toBe("dark");
  });
});
