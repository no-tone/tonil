/* Node click routing. `resolveNavigationIntent` is a pure function (id +
   node table in, an intent description out) so the routing rules — panel vs.
   mailto vs. external link, unknown ids — are unit-testable without a DOM.
   `performNavigation` is the thin, side-effecting half that actually acts on
   an intent. */

import type { NodeDef } from "./data";
import type { PanelId } from "./panels";

type NavigationIntent =
  | { kind: "panel"; id: PanelId }
  | { kind: "mailto"; href: string }
  | { kind: "external"; href: string }
  | { kind: "noop" };

export function resolveNavigationIntent(
  id: string,
  nodes: NodeDef[],
): NavigationIntent {
  const node = nodes.find((n) => n.id === id);
  if (!node) return { kind: "noop" };
  if (node.type === "link") {
    const href = node.href ?? "";
    if (!href) return { kind: "noop" };
    if (href.startsWith("mailto:")) return { kind: "mailto", href };
    return { kind: "external", href };
  }
  return { kind: "panel", id: node.id as PanelId };
}

export interface NavigationActions {
  openPanel: (id: PanelId) => void;
  navigateTo: (href: string) => void;
  openExternal: (href: string) => void;
}

export function performNavigation(
  intent: NavigationIntent,
  actions: NavigationActions,
): void {
  if (intent.kind === "panel") actions.openPanel(intent.id);
  else if (intent.kind === "mailto") actions.navigateTo(intent.href);
  else if (intent.kind === "external") actions.openExternal(intent.href);
}
