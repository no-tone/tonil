import { describe, expect, it, vi } from "vitest";
import type { NodeDef } from "../src/scripts/desktop/data";
import {
  type NavigationActions,
  performNavigation,
  resolveNavigationIntent,
} from "../src/scripts/desktop/navigation";

const NODES: NodeDef[] = [
  { id: "projects", lat: 0, lon: 0, type: "panel" },
  {
    id: "contact",
    lat: 0,
    lon: 0,
    type: "link",
    href: "mailto:msg@no-tone.com",
  },
  {
    id: "github",
    lat: 0,
    lon: 0,
    type: "link",
    href: "https://github.com/no-tone",
  },
  { id: "broken-link", lat: 0, lon: 0, type: "link" },
];

describe("resolveNavigationIntent", () => {
  it("routes a panel node to a panel intent", () => {
    expect(resolveNavigationIntent("projects", NODES)).toEqual({
      kind: "panel",
      id: "projects",
    });
  });

  it("routes a mailto link node to a mailto intent", () => {
    expect(resolveNavigationIntent("contact", NODES)).toEqual({
      kind: "mailto",
      href: "mailto:msg@no-tone.com",
    });
  });

  it("routes an http(s) link node to an external intent", () => {
    expect(resolveNavigationIntent("github", NODES)).toEqual({
      kind: "external",
      href: "https://github.com/no-tone",
    });
  });

  it("is a noop for an unknown id", () => {
    expect(resolveNavigationIntent("nope", NODES)).toEqual({ kind: "noop" });
  });

  it("is a noop for a link node with no href", () => {
    expect(resolveNavigationIntent("broken-link", NODES)).toEqual({
      kind: "noop",
    });
  });
});

describe("performNavigation", () => {
  it("dispatches each intent kind to its matching action", () => {
    const actions: NavigationActions = {
      openPanel: vi.fn(),
      navigateTo: vi.fn(),
      openExternal: vi.fn(),
    };

    performNavigation({ kind: "panel", id: "projects" }, actions);
    expect(actions.openPanel).toHaveBeenCalledWith("projects");

    performNavigation(
      { kind: "mailto", href: "mailto:msg@no-tone.com" },
      actions,
    );
    expect(actions.navigateTo).toHaveBeenCalledWith("mailto:msg@no-tone.com");

    performNavigation(
      { kind: "external", href: "https://github.com/no-tone" },
      actions,
    );
    expect(actions.openExternal).toHaveBeenCalledWith(
      "https://github.com/no-tone",
    );

    performNavigation({ kind: "noop" }, actions);
    expect(actions.openPanel).toHaveBeenCalledTimes(1);
    expect(actions.navigateTo).toHaveBeenCalledTimes(1);
    expect(actions.openExternal).toHaveBeenCalledTimes(1);
  });
});
