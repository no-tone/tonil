import { zValidator } from "@hono/zod-validator";
import { summarizeCspReport } from "@repo/content";
import { cspReportBodySchema, validationProblemHook } from "@repo/validation";
import { Hono } from "hono";
import type { AppEnv } from "../env";

const noCacheHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export const cspReportRoute = new Hono<AppEnv>();

cspReportRoute.post(
  "/",
  zValidator("json", cspReportBodySchema, validationProblemHook),
  (c) => {
    const body = c.req.valid("json");
    console.warn(
      "[csp-report]",
      summarizeCspReport(JSON.stringify(body), new URL(c.req.url).pathname),
    );
    return c.body(JSON.stringify({ ok: true }), 202, noCacheHeaders);
  },
);

cspReportRoute.get("/", (c) =>
  c.body(JSON.stringify({ ok: true }), 200, noCacheHeaders),
);
