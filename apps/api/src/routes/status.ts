import { createAuth } from "@repo/auth";
import { SELF_HOSTED_APPS } from "@repo/content";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { getTailnetDevice, probeAllApps } from "../services/app-health";

export const statusRoute = new Hono<AppEnv>();

// Self-hosted app up/down + Tailscale device presence is only meant for the
// (now Better-Auth-gated) dashboard — without this, anyone could hit this
// endpoint directly, bypassing the dashboard's own login wall entirely.
// Not reusing @repo/auth's requireSession() here: it's typed against its own
// SessionEnv (Variables: { session }), which doesn't line up with AppEnv's
// Variables across a Hono sub-app boundary — the check itself is one line,
// so duplicating it is simpler than fighting the generics.
statusRoute.use("*", async (c, next) => {
  const auth = createAuth({
    DB: c.env.DB,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    BETTER_AUTH_API_KEY: c.env.BETTER_AUTH_API_KEY,
  });
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  await next();
});

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
