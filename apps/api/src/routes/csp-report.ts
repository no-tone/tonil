import { zValidator } from "@hono/zod-validator";
import {
  isSelfInflictedTransitionReport,
  summarizeCspReport,
} from "@repo/content";
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
    // Still a 202 either way: the browser is not doing anything wrong, and
    // an error here would only produce a second kind of noise.
    if (!isSelfInflictedTransitionReport(summary)) {
      console.warn("[csp-report]", summary);
    }
    return c.body(JSON.stringify({ ok: true }), 202, noCacheHeaders);
  },
);

cspReportRoute.get("/", (c) =>
  c.body(JSON.stringify({ ok: true }), 200, noCacheHeaders),
);
