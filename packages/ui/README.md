# @repo/ui

Shared design system for `apps/web` and `apps/dashboard`: design tokens, theming, a small vanilla-DOM component kit, and the shared `<head>` component. Nothing here is Astro-only — the components are plain functions returning `HTMLElement`s, so any app in this monorepo can use them regardless of how much Astro/React/etc it wraps around them.

## Importing from this package

`package.json`'s `exports` map has a wildcard fallback (`"./*": "./src/*"`) that covers any import specifier which already includes its own file extension — `@repo/ui/BaseHead.astro`, `@repo/ui/styles/tokens.css?inline`. Extension-less `.ts` modules (`@repo/ui/dom`, not `@repo/ui/dom.ts`) need their own explicit entry instead, because TypeScript's `node16`/`nodenext` module resolution (which this package's `tsconfig.json` uses) requires relative imports inside the package to carry an explicit `.js` extension, and the wildcard can't infer one for a bare specifier — see the `"./dom"`/`"./components"`/`"./storage"`/`"./theme-bootstrap"` entries for the pattern. Examples of what exists today:

```ts
import BaseHead from "@repo/ui/BaseHead.astro";
import { btnLink, chips, codeBlock, panelHead, tag } from "@repo/ui/components";
import { h, clear } from "@repo/ui/dom";
import { readStored, writeStored } from "@repo/ui/storage";
import type { TonilThemeHelpers, Theme } from "@repo/ui/theme-bootstrap";

import resetCss from "@repo/ui/styles/reset.css?inline";   // inlined under a CSP nonce (apps/web's pattern)
import tokensCss from "@repo/ui/styles/tokens.css?inline";
import componentsCss from "@repo/ui/styles/components.css?inline";
import "@repo/ui/styles/tokens.css";                        // or linked as a real stylesheet (apps/dashboard's pattern)
```

## What's here

### `BaseHead.astro`

The shared `<head>`: favicon/meta tags, canonical/hreflang, OG/Twitter tags, JSON-LD (merges a default `WebSite` schema with a per-page `schema` prop), and two inline nonce'd scripts — a pre-paint theme bootstrap (reads `localStorage.theme`, sets `documentElement.dataset.theme` before first paint to avoid a flash) and the `window.tonil` theme helpers described below. See the `Props` interface at the top of the file for the full prop list.

Every consumer needs `Astro.locals.cspNonce` typed in its own `env.d.ts` — see the comment in `src/env.d.ts` for why that can't be inherited across a package boundary.

### Theming (`styles/tokens.css`, `styles/reset.css`, `theme-bootstrap.ts`)

- `tokens.css` — `@font-face` declarations + every design token as a CSS custom property (`--bg`, `--text*`, `--accent*`, `--font-*`, spacing/radius/motion scales, …), with a `html[data-theme="light"]` block overriding the semantic tokens for light mode. Dark is the implicit default.
- `reset.css` — box-sizing, scrollbar theming, focus rings, `.sr-only`, and other app-agnostic base styles. Deliberately does **not** set `body { overflow: hidden }` — that's a layout choice specific to apps/web's locked-viewport "desktop" page, so it stays in `apps/web/src/styles/desktop/base.css`.
- `theme-bootstrap.ts` — just the `Theme`/`TonilThemeHelpers` types for the `window.tonil` object `BaseHead.astro`'s inline script installs at runtime (`getStoredTheme`, `applyTheme`, `readTheme`, `syncTheme`, `setStoredTheme`, plus a `tonil:themechange` event for cross-widget sync). Each app's own theme-toggle script (`apps/web/src/scripts/desktop/theme.ts`, `apps/dashboard/src/scripts/theme.ts`) types against this instead of hand-declaring its own copy.

### Design-system primitives (`components.ts` + `styles/components.css`)

Vanilla-DOM component builders — no framework, no virtual DOM, just `HTMLElement` factories built on top of `dom.ts`'s tiny `h()` hyperscript helper. Class names (`vire-btn`, `vire-tag`, `vire-code*`) are paired 1:1 with the CSS in `styles/components.css`.

| Export | Renders |
|---|---|
| `tag(text, tone?)` | `<span class="vire-tag">` (or `vire-tag--accent`) |
| `btnLink(text, href, primary?)` | `<a class="vire-btn">` styled as a button, opens in a new tab |
| `chips(items, tone?)` | a `<div class="vp__chips">` of `tag()`s |
| `codeBlock(filename, code)` | a `<div class="vire-code">` with a line-numbered gutter, mirroring a small code-editor chrome |
| `panelHead(eyebrow, title, src?)` | a `<header class="vp__head">` with an eyebrow line, a title, and an optional trailing element |
| `openExternal(href)` | safely `window.open`s an `http(s)` URL in a new tab, no-ops otherwise |

`dom.ts` (`h(tag, attrs, ...children)`, `clear(node)`) and `storage.ts` (`readStored`/`writeStored`, a try/catch-guarded `localStorage` wrapper) are the two small utilities these primitives — and any future ones — are built on.

## Adding a new shared component

1. Ask: does this genuinely need to render the same way in more than one app? If it's specific to one app's content or layout, it belongs in that app instead (see `docs/architecture.md`'s "does this go in a package?" rule of thumb).
2. Drop the function in `src/<name>.ts` (or a new file), export it, and add its CSS (if any) to `styles/<name>.css` — or a new stylesheet if it's a big enough addition to warrant one. Any relative import between two `src/*.ts` modules needs an explicit `.js` extension (e.g. `import { h } from "./dom.js"`) — that's `node16`/`nodenext` module resolution, not a typo.
3. Add a `"./<name>": "./src/<name>.ts"` entry to `package.json`'s `exports` map (the wildcard alone won't resolve an extension-less specifier — see above) and document it in the table above.
4. Add a Vitest unit test in `test/<name>.test.ts` (see `test/dom.test.ts`/`test/components.test.ts` for the pattern — this package runs its tests under `jsdom`, see `vitest.config.ts`).
5. Update whichever app(s) should adopt it to import from `@repo/ui/<name>` instead of a local copy — don't let the same component exist in two places.
