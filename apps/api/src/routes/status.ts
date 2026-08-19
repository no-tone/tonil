import { SELF_HOSTED_APPS } from "@repo/content";
import { requireCloudflareAccess } from "@repo/hono-middleware";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getTailnetDevice, probeAllApps } from "../services/app-health";

export const statusRoute = new Hono<AppEnv>();

const ACCESS_TEAM_DOMAIN = "no-tone.cloudflareaccess.com";
// The "dashboard.no-tone.workers.dev" Access application's AUD tag.
const ACCESS_AUD =
  "28a3efd8f96a2e859f3bcd8158570e67538c297b25a8d7de9803b877e8a1881a";

// Self-hosted app up/down + Tailscale device presence is only meant for the
// dashboard, which is gated behind a Cloudflare Access policy - but that
// policy lives on a different hostname (dash.no-tone.com), so it doesn't
// automatically cover this route. apps/dashboard's own api/status.ts proxies
// here server-to-server, forwarding the Cf-Access-Jwt-Assertion header
// Access already attached to ITS incoming request; verify that here instead.
statusRoute.use(
  "*",
  requireCloudflareAccess({ teamDomain: ACCESS_TEAM_DOMAIN, aud: ACCESS_AUD }),
);

statusRoute.get("/", async (c) => {
  const [apps, tailnetDevice] = await Promise.all([
    probeAllApps(SELF_HOSTED_APPS),
    getTailnetDevice(c.env),
  ]);

  return c.json(
    {
      generatedAt: new Date().toISOString(),
      apps,
      tailnet: { device: tailnetDevice },
    },
    200,
    { "Cache-Control": "no-store" },
  );
});
