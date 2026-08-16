import type { Context, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** RFC 7807 problem details object. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}

export function problemDetails(
  status: number,
  title: string,
  extra: Partial<ProblemDetails> = {},
): ProblemDetails {
  return { type: "about:blank", title, status, ...extra };
}

export function problemResponse(c: Context, problem: ProblemDetails): Response {
  return c.body(
    JSON.stringify(problem),
    problem.status as ContentfulStatusCode,
    {
      "Content-Type": "application/problem+json; charset=utf-8",
    },
  );
}

/**
 * An `app.onError` handler (NOT middleware — Hono resolves thrown errors via
 * its own onError hook before they'd reach a wrapping middleware's catch
 * block) that renders any error as application/problem+json.
 */
export function problemJson(): ErrorHandler {
  return (err, c) => {
    const status = err instanceof HTTPException ? err.status : 500;
    const title =
      err instanceof HTTPException ? err.message : "Internal Server Error";
    const problem = problemDetails(status, title, {
      instance: new URL(c.req.url).pathname,
    });
    return problemResponse(c, problem);
  };
}
