import { afterEach, describe, expect, it, vi } from "vitest";
import {
  btnLink,
  chips,
  codeBlock,
  openExternal,
  panelHead,
  tag,
} from "../src/components";

describe("tag", () => {
  it("renders a plain tag", () => {
    const el = tag("hono");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toBe("vire-tag");
    expect(el.textContent).toBe("hono");
  });

  it("renders an accent tag", () => {
    expect(tag("hono", "accent").className).toBe("vire-tag vire-tag--accent");
  });
});

describe("btnLink", () => {
  it("renders an external link button", () => {
    const el = btnLink("github", "https://github.com/x");
    expect(el.tagName).toBe("A");
    expect(el.className).toBe("vire-btn");
    expect(el.getAttribute("href")).toBe("https://github.com/x");
    expect(el.getAttribute("target")).toBe("_blank");
    expect(el.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("renders a primary variant", () => {
    expect(btnLink("go", "/x", true).className).toBe(
      "vire-btn vire-btn--primary",
    );
  });
});

describe("openExternal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens http(s) urls in a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openExternal("https://example.com");
    expect(open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("ignores non-http(s) and malformed urls", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openExternal("javascript:alert(1)");
    openExternal("not a url");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("panelHead", () => {
  it("renders an eyebrow + title, with an optional trailing element", () => {
    const src = document.createElement("span");
    const el = panelHead("cv", "curriculum", src);
    expect(el.tagName).toBe("HEADER");
    expect(el.className).toBe("vp__head");
    expect(el.querySelector(".vp__eyebrow")?.textContent).toBe("cv");
    expect(el.querySelector(".vp__title")?.textContent).toBe("curriculum");
    expect(el.contains(src)).toBe(true);
  });
});

describe("chips", () => {
  it("renders one tag per item", () => {
    const el = chips(["hono", "astro"]);
    expect(el.className).toBe("vp__chips");
    expect(el.querySelectorAll(".vire-tag")).toHaveLength(2);
  });
});

describe("codeBlock", () => {
  it("renders a gutter line + body line per source line", () => {
    const el = codeBlock("x.ts", "a\nb\n");
    expect(el.className).toBe("vire-code");
    expect(
      el.querySelector(".vire-code__bar span:last-child")?.textContent,
    ).toBe("x.ts");
    expect(el.querySelectorAll(".vire-code__gutter span")).toHaveLength(2);
    expect(el.querySelectorAll(".vire-code__lines span")).toHaveLength(2);
  });
});
