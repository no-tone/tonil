import type { Env, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Auth } from "./auth";

type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;

export type SessionEnv = Env & { Variables: { session: NonNullable<Session> } };

/** Gates a route group behind a valid Better Auth session (401 problem+json via the shared problemJson error handler if absent). */
export function requireSession(auth: Auth): MiddlewareHandler<SessionEnv> {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    c.set("session", session);
    await next();
  };
}
