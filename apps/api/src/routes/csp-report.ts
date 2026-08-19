import { zValidator } from "@hono/zod-validator";
import { summarizeCspReport } from "@repo/content";
import { problemDetails, problemResponse } from "@repo/hono-middleware";
import { cspReportBodySchema, validationProblemHook } from "@repo/validation";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../env";

const noCacheHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

// This is a public, unauthenticated POST - the only one on the API. Real CSP
// reports are a couple of KB at most, so cap the body well below that rather
// than letting anyone stream arbitrary bytes into the Worker.
const MAX_BODY_BYTES = 16 * 1024;

export const cspReportRoute = new Hono<AppEnv>();

cspReportRoute.post(
  "/",
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) =>
      problemResponse(
        c,
        problemDetails(413, "Payload Too Large", {
          instance: new URL(c.req.url).pathname,
        }),
      ),
  }),
  zValidator("json", cspReportBodySchema, validationProblemHook),
  (c) => {
    const body = c.req.valid("json");
    const summary = summarizeCspReport(
      JSON.stringify(body),
      new URL(c.req.url).pathname,
    );
    // Every report is logged again. The filter that used to sit here dropped
    // the inline-style violations ClientRouter provoked on every navigation;
    // the site no longer runs ClientRouter, so the only thing that filter
    // could still catch is a real one. See @repo/content's
    // csp-report-summary.ts.
    console.warn("[csp-report]", summary);
    // 202 whatever the report says: the browser is not doing anything wrong
    // by sending it, and an error here would only produce a second kind of
    // noise.
    return c.body(JSON.stringify({ ok: true }), 202, noCacheHeaders);
  },
);

cspReportRoute.get("/", (c) =>
  c.body(JSON.stringify({ ok: true }), 200, noCacheHeaders),
);
