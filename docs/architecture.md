# Architecture

How the three apps and six packages fit together, and why things live where they do. For the visual/brand philosophy, see [constitution.md](./constitution.md). For technical conventions, see [engineering.md](./engineering.md). For deploying this, see [deployment.md](./deployment.md).

## The three apps

- **`apps/web`** — the public site, no-tone.com. Astro, server-rendered, its own Cloudflare Worker.
- **`apps/dashboard`** — the self-hosted-services launcher, dashboard.no-tone.com. Astro, its own Cloudflare Worker.
- **`apps/api`** — api.no-tone.com. Hono, Cloudflare Workers, the single source of truth for anything both apps (or an external agent) might need.

Both Astro apps are deliberately thin: they render markup and ship the client-side interaction (globe, panels, filters, theme toggle). Neither has its own API routes for data that isn't page-specific — that's what `apps/api` is for.

## Why the API is centralized

Before this monorepo existed, no-tone.com and main-menu were separate repos, each with its own Cloudflare Worker doing its own GitHub-proxy caching, its own Tailscale OAuth probing, its own CSP-report ingestion. Centralizing all of that in `apps/api` means:

- One cache/ETag-revalidation implementation for the GitHub repos proxy (`GET /projects`), not two.
- One Tailscale-OAuth + app-health-probing implementation (`GET /status`), reusable by both `apps/web` (if it ever needs live status) and `apps/dashboard`.
- One CSP-report ingestion endpoint (`POST /csp-report`), validated with Zod (`packages/validation`) instead of hand-parsed JSON.
- One Better Auth instance (`packages/auth`, backed by Cloudflare D1), so a login system doesn't need to be built twice if `apps/dashboard` ever needs one.

## Why the security/CSP logic is a plain function, not just Hono middleware

`apps/web` and `apps/dashboard` are each their own Cloudflare Worker — they don't run through `apps/api`'s Hono app, so they can't use Hono middleware directly. But the CSP-nonce-generation and security-header logic needs to be identical everywhere (that's the whole point of centralizing it). The fix: `packages/hono-middleware/src/core.ts` exports plain, framework-agnostic functions (`buildSecurityHeaders`, `buildApiCatalogBody`). `apps/api` wraps them as Hono middleware (`securityHeaders()`, `apiCatalog()`); `apps/web`/`apps/dashboard` call the same core functions directly from their own Astro `middleware.ts`. One implementation, two thin adapters.

## Why site content lives in `packages/content`, not each app

`packages/content/src/site-info.ts` defines each site's name, tagline, description, links, and agent-readable markdown once. `apps/api`'s `/info/:slug` route serves that same record three ways — as JSON, as markdown (via `Accept: text/markdown` content negotiation), and as server-rendered HTML via `hono/jsx` — so there's one source of truth instead of three copies of the same "here's who we are" text drifting apart.

## Package map

| Package | What it holds | Consumed by |
|---|---|---|
| `packages/ui` | `BaseHead.astro` (meta tags, theme bootstrap, OG/schema.org), design tokens + reset CSS | `apps/web`, `apps/dashboard` |
| `packages/content` | Self-hosted app registry, GitHub-repo simplification, CSP-report summarizing, per-site info/markdown | `apps/api`, `apps/dashboard` |
| `packages/validation` | Zod schemas, an RFC 7807 validation-failure hook for `@hono/zod-validator` | `apps/api` |
| `packages/hono-middleware` | Composable Hono middleware + the framework-agnostic core both Astro apps call directly | `apps/api`, `apps/web`, `apps/dashboard` |
| `packages/auth` | Better Auth setup (email/password) on Cloudflare D1, a `requireSession` middleware | `apps/api` |
| `packages/typescript-config` | Shared tsconfig presets (`base`, `astro`, `hono-jsx`) | every app/package |

## Rule of thumb for "does this go in a package?"

If the same logic would otherwise need writing twice — once in `apps/web`, once in `apps/dashboard` — it belongs in a package. If it's genuinely specific to one app's content or layout, it stays local to that app.
