<div align="center">

# 🧭 tonil

**One repo behind no-tone.com, its self-hosted-services dashboard, and the API tying them together.**

![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white)
![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Worker-F38020?logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-60A5FA?logo=biome&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)

<p>
  <a href="#overview">Overview</a>
  ·
  <a href="#commands">Commands</a>
  ·
  <a href="#structure">Structure</a>
  ·
  <a href="#setup">Setup</a>
  ·
  <a href="#deploy">Deploy</a>
  ·
  <a href="#docs">Docs</a>
</p>

</div>

---

Three apps, one Hono API, six shared packages — built with [Astro](https://astro.build) and [Hono](https://hono.dev), deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/).

## Overview

```
tonil  ───  Bun + Turborepo  ───  three Cloudflare Workers
      │
      ├── apps/web         no-tone.com — the WebGL-globe portfolio site
      ├── apps/dashboard   dashboard.no-tone.com — self-hosted-services launcher
      └── apps/api         api.no-tone.com — Hono, the one source of truth for both
```

`apps/web` and `apps/dashboard` are deliberately thin: markup + client-side interaction, nothing else. Anything either app needs that isn't page-specific — the GitHub-repos proxy, self-hosted app health + Tailscale status, CSP-report ingestion, auth — lives once in `apps/api` and gets called from both. See [docs/architecture.md](./docs/architecture.md) for the why.

## Commands

Run from the repo root — Turborepo fans these out per app/package:

| Command | Action |
|---|---|
| `bun run dev` | Start all three apps in dev mode |
| `bun run build` | Production build, every app |
| `bun run test` | Vitest across every app and package |
| `bun run lint` | Biome check |
| `bun run check-types` | `tsc`/`astro check` per app and package |
| `bun run knip` | Unused files, exports, and dependencies |
| `bun run check-cycles` | Import-cycle detection (madge) |

## Structure

| Path | What |
|---|---|
| `apps/web/` | The public site — globe nav, project/CV/about panels |
| `apps/dashboard/` | The self-hosted-apps launcher + live status |
| `apps/api/` | Hono API: `/projects`, `/status`, `/csp-report`, `/info/:slug` |
| `packages/ui/` | `BaseHead.astro`, shared design tokens + reset CSS |
| `packages/content/` | Self-hosted app registry, GitHub-repo simplification, per-site info/markdown |
| `packages/validation/` | Zod schemas + an RFC 7807 validation-failure hook |
| `packages/hono-middleware/` | Security headers/CSP, RFC 9727 catalog, markdown negotiation, RFC 7807 errors, Cloudflare Access JWT verification — as Hono middleware and as the framework-agnostic functions the Astro apps call directly |
| `packages/typescript-config/` | Shared tsconfig presets |
| `docs/` | Design philosophy, engineering standards, architecture notes, deployment runbook |

## Setup

```bash
bun install
```

Each app needs its own env file for local dev — see `apps/api/.dev.vars.example` and copy it to `.dev.vars`.

## Deploy

```bash
cd apps/api && wrangler deploy
cd apps/web && wrangler deploy
cd apps/dashboard && wrangler deploy
```

Requires a Cloudflare account with Workers + D1 enabled. Migrating off the previous three-separate-repos setup? See [docs/deployment.md](./docs/deployment.md) for the full cutover runbook (custom domains, secrets, order of operations, retiring the old Workers).

## Docs

- [docs/constitution.md](./docs/constitution.md) — brand personality, visual system, motion, the "why does this exist?" component test
- [docs/engineering.md](./docs/engineering.md) — language, validation, API, git conventions
- [docs/architecture.md](./docs/architecture.md) — how the apps and packages fit together
- [docs/deployment.md](./docs/deployment.md) — the Cloudflare cutover runbook
- [AGENTS.md](./AGENTS.md) — index into all of the above, for agents/contributors
