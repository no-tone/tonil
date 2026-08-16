# Deploying to Cloudflare

This monorepo replaces three previously-separate Cloudflare Workers (the old `no-tone.com` repo's Worker, whatever Worker currently serves `www.no-tone.com`, and the old `main-menu` repo's Worker) with three Workers deployed from **one** repo: `apps/web`, `apps/dashboard`, `apps/api`. This doc is a runbook for cutting over — I haven't run any of these steps myself (deploying, changing DNS/custom domains, or deleting the old Workers are all live-infrastructure changes that need your Cloudflare account, and are risky enough that they should be deliberate, not automated by an agent).

## The target end state

| Hostname | Worker (this repo) | Notes |
|---|---|---|
| `no-tone.com` | `apps/web` | |
| `www.no-tone.com` | `apps/web` (same Worker, second custom domain) | `apps/web/src/middleware.ts` already 301-redirects `www` → apex — **no separate Worker needed for this.** Whatever currently serves `www.no-tone.com` can be retired once this domain points at the `web` Worker instead. |
| `dash.no-tone.com` | `apps/dashboard` | Replaces main-menu's `apps.no-tone.com` |
| `api.no-tone.com` | `apps/api` | New — didn't exist as its own domain before |

So: **3 Workers, same as today, but all three now come from this repo**, and the separate `www` Worker (if it's actually its own Worker rather than a DNS-only redirect rule) goes away entirely.

## Why not fewer Workers?

You asked whether `www` could just be folded into `api` — it's simpler to fold it into `web` instead, since `web` already contains the exact redirect logic (ported verbatim from no-tone.com's original middleware) and serving it from `api` would mean `api` needs to know about `web`'s hostname concerns, which is the wrong direction of coupling. One Worker, two custom domains (`no-tone.com` + `www.no-tone.com`) pointed at it, is the standard Cloudflare pattern for this.

## Order of operations

Do this during low-traffic hours, and don't delete anything old until the new Worker has been serving real production traffic successfully for a while.

### 1. Stand up `apps/api` first (nothing depends on it yet, so it's zero-risk)

```bash
cd apps/api
wrangler secret put GITHUB_TOKEN               # optional — raises the GitHub API rate limit for /projects
wrangler secret put TAILSCALE_OAUTH_CLIENT_ID  # optional — only if /status should report Tailscale device status
wrangler secret put TAILSCALE_OAUTH_CLIENT_SECRET
wrangler secret put TAILSCALE_TAILNET
wrangler secret put TAILSCALE_STATUS_DEVICE
wrangler deploy
```

`wrangler.jsonc` already declares `"routes": [{ "pattern": "api.no-tone.com", "custom_domain": true }]`, so `wrangler deploy` provisions the custom domain itself — no dashboard click needed. Verify `curl https://api.no-tone.com/status` and `curl https://api.no-tone.com/.well-known/api-catalog` before moving on.

### 2. Verify `apps/web` and `apps/dashboard` before touching production DNS

`apps/web/wrangler.jsonc` has `workers_dev: false` and `preview_urls: false` (carried over from no-tone.com's original production hardening — no publicly-guessable `*.workers.dev` URL bypassing the intended custom domain), so its `*.workers.dev` URL isn't available even after deploying. Verify it locally instead:

```bash
cd apps/web && wrangler dev          # http://localhost:8787 — click through the globe/panels/theme toggle
```

`apps/dashboard` doesn't set `workers_dev: false`, so its preview URL works after a real deploy:

```bash
cd apps/dashboard && wrangler deploy  # check the printed *.workers.dev URL — tiles render, /status is populated from api.no-tone.com
```

If you want a pre-cutover check against the real Worker (not just local `wrangler dev`) for `apps/web` too, temporarily bind a throwaway custom domain (e.g. `web-preview.no-tone.com`) to it, verify, then remove that binding before the real cutover in step 3.

### 3. Cut over `no-tone.com` and `www.no-tone.com`

In the dashboard: add `no-tone.com` and `www.no-tone.com` as custom domains on the **new** `web` Worker. Cloudflare will generally require removing a custom domain from its old Worker before it can be attached to a new one — so this is a brief-downtime swap, not a zero-downtime one, unless you stage it through a maintenance page. Do `no-tone.com` and `www.no-tone.com` in the same sitting so there's no window where one redirects to the other's old Worker.

### 4. Cut over the dashboard subdomain

Same as above, but for `apps.no-tone.com` (main-menu's current subdomain) → `dash.no-tone.com`, pointed at the new `dashboard` Worker.

### 5. Confirm, then retire the old Workers

Once `no-tone.com`, `www.no-tone.com`, and the dashboard subdomain have all been serving from the new Workers without issues for a bit: delete the old `no-tone`, `main-menu`, and (if it's a separate Worker rather than a bare DNS redirect rule) `www` Workers from the Cloudflare dashboard. Keep the old `no-tone.com`/`main-menu` git repos around read-only for a while as a reference — no need to delete those.

## Ongoing deploys

`.github/workflows/ci.yml` currently only builds/lints/tests/type-checks on push — it does **not** deploy. If you want CI to auto-deploy on merge to `main`, add a deploy job gated on the existing checks passing, authenticated via a `CLOUDFLARE_API_TOKEN` repo secret (Cloudflare dashboard → My Profile → API Tokens → create one scoped to "Edit Cloudflare Workers" for your account) and run `wrangler deploy` per app. Not set up yet since it needs that token, which only you can create.
