import {
  problemDetails,
  problemResponse,
} from "@repo/hono-middleware/problem-json";
import type { Context } from "hono";

type ZodValidatorHookResult =
  | { success: true }
  | {
      success: false;
      error: { issues: { path: PropertyKey[]; message: string }[] };
    };

/**
 * A `@hono/zod-validator` failure hook that renders validation errors as an
 * RFC 7807 problem+json response instead of the library's default plain JSON
 * `{ success: false, error }` shape, so every 4xx from apps/api — validation
 * or otherwise — looks the same on the wire.
 */
export function validationProblemHook(
  result: ZodValidatorHookResult,
  c: Context,
) {
  if (result.success) return;
  const problem = problemDetails(400, "Validation Failed", {
    instance: new URL(c.req.url).pathname,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
  return problemResponse(c, problem);
}
