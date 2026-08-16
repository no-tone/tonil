import { describe, expect, it, vi } from "vitest";
import { clear, h } from "../src/dom";

describe("h", () => {
  it("creates an element with the given tag", () => {
    expect(h("div").tagName).toBe("DIV");
  });

  it("sets class via the class attr", () => {
    expect(h("span", { class: "a b" }).className).toBe("a b");
  });

  it("sets string/number attrs via setAttribute", () => {
    const el = h("a", { href: "/x", "data-index": 3 });
    expect(el.getAttribute("href")).toBe("/x");
    expect(el.getAttribute("data-index")).toBe("3");
  });

  it("sets boolean-true attrs as empty and omits boolean-false/undefined", () => {
    const el = h("input", { disabled: true, hidden: false, title: undefined });
    expect(el.getAttribute("disabled")).toBe("");
    expect(el.hasAttribute("hidden")).toBe(false);
    expect(el.hasAttribute("title")).toBe(false);
  });

  it("wires on* attrs as event listeners", () => {
    const onClick = vi.fn();
    const el = h("button", { onClick });
    el.dispatchEvent(new Event("click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("appends string/number/Node children and skips null/undefined/false", () => {
    const child = h("i");
    const el = h("div", {}, "text", 1, child, null, undefined, false);
    expect(el.textContent).toBe("text1");
    expect(el.contains(child)).toBe(true);
    expect(el.childNodes).toHaveLength(3);
  });
});

describe("clear", () => {
  it("removes every child from a node", () => {
    const el = h("div", {}, h("span"), h("span"));
    expect(el.childNodes).toHaveLength(2);
    clear(el);
    expect(el.childNodes).toHaveLength(0);
  });
});
