import { zValidator } from "@hono/zod-validator";
import { problemDetails, problemResponse } from "@repo/hono-middleware";
import {
  sshAuthorizeBodySchema,
  validationProblemHook,
} from "@repo/validation";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../env";
import { parseAllowlist, timingSafeEqual } from "../services/ssh-allowlist";

const noCacheHeaders = {
  // The answer decides access. It must never sit in an edge or browser cache,
  // where a revoked key would keep working until it expired.
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

// A fingerprint is ~50 bytes. Anything past this is not a real request.
const MAX_BODY_BYTES = 1024;

export const sshRoute = new Hono<AppEnv>();

/**
 * Resolve an SSH key fingerprint to the scopes it holds.
 *
 * Called by apps/ssh-cv during the SSH handshake - see that app's
 * internal/authz. Only the fingerprint crosses the wire; the public key never
 * leaves the SSH host.
 *
 * The bearer token is not optional. Without it this endpoint is an oracle:
 * anyone could probe fingerprints and learn which are privileged, and the
 * allowlist would leak one bit at a time. If the token is unset in the
 * environment the endpoint refuses every request rather than falling back to
 * an open mode, so a half-configured deploy fails closed.
 */
sshRoute.post(
  "/authorize",
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
  async (c, next) => {
    const expected = c.env.SSH_GATEWAY_TOKEN;
    const header = c.req.header("Authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (
      !expected ||
      !presented ||
      !(await timingSafeEqual(presented, expected))
    ) {
      return problemResponse(
        c,
        problemDetails(401, "Unauthorized", {
          detail: "A valid gateway bearer token is required.",
          instance: new URL(c.req.url).pathname,
        }),
      );
    }
    await next();
  },
  zValidator("json", sshAuthorizeBodySchema, validationProblemHook),
  (c) => {
    const { fingerprint } = c.req.valid("json");
    const grant = parseAllowlist(c.env.SSH_AUTHORIZED_KEYS).get(fingerprint);

    // An unknown key gets the same shape of answer as a known one, so the
    // response body is not a side channel for "does this fingerprint exist".
    return c.body(
      JSON.stringify({
        allowed: !!grant,
        label: grant?.label ?? "",
        scopes: grant?.scopes ?? [],
      }),
      200,
      noCacheHeaders,
    );
  },
);
