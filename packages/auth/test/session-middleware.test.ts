import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";
import type { Auth } from "../src/auth";
import { requireSession, type SessionEnv } from "../src/session-middleware";

function fakeAuth(session: unknown): Auth {
  return {
    api: { getSession: vi.fn().mockResolvedValue(session) },
  } as unknown as Auth;
}

describe("requireSession", () => {
  it("lets the request through and sets c.get('session') when a session exists", async () => {
    const app = new Hono<SessionEnv>();
    app.use(requireSession(fakeAuth({ user: { id: "u1" } })));
    app.get("/private", (c) => c.json({ userId: c.get("session").user.id }));

    const res = await app.request("/private");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "u1" });
  });

  it("throws a 401 HTTPException when there is no session", async () => {
    const app = new Hono();
    app.use(requireSession(fakeAuth(null)));
    app.get("/private", (c) => c.json({ ok: true }));
    app.onError((err, c) => {
      const status = err instanceof HTTPException ? err.status : 500;
      return c.json({ error: "unauthorized" }, status);
    });

    const res = await app.request("/private");
    expect(res.status).toBe(401);
  });
});
