import { createAuth } from "@repo/auth";
import { Hono } from "hono";
import type { AppEnv } from "../env";

export const authRoute = new Hono<AppEnv>();

authRoute.on(["GET", "POST"], "/*", (c) => {
  const auth = createAuth({
    DB: c.env.DB,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    BETTER_AUTH_API_KEY: c.env.BETTER_AUTH_API_KEY,
  });
  return auth.handler(c.req.raw);
});
