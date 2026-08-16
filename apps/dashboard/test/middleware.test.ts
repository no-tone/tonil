import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../src/middleware";

function buildContext(url: string, init?: RequestInit) {
  return {
    request: new Request(url, init),
    locals: {} as { cspNonce?: string },
  };
}

const next = async () =>
  new Response("<html><body>ok</body></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });

function stubSession(session: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(session), { status: ok ? 200 : 500 }),
    ),
  );
}

describe("apps/dashboard middleware", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always lets /login through without checking for a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("should not be called");
      }),
    );
    const ctx = buildContext("https://apps.no-tone.com/login");
    const res = await onRequest(ctx as never, next);
    expect(res.status).toBe(200);
  });

  it("passes the request through when a session exists", async () => {
    stubSession({ session: { id: "s1" }, user: { id: "u1" } });
    const ctx = buildContext("https://apps.no-tone.com/");
    const res = await onRequest(ctx as never, next);
    expect(await res.text()).toBe("<html><body>ok</body></html>");
  });

  it("forwards the incoming Cookie header to apps/api's get-session endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ session: {}, user: {} }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const ctx = buildContext("https://apps.no-tone.com/", {
      headers: { cookie: "better-auth.session_token=abc" },
    });
    await onRequest(ctx as never, next);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.no-tone.com/api/auth/get-session",
      expect.objectContaining({
        headers: { cookie: "better-auth.session_token=abc" },
      }),
    );
  });

  it("redirects to /login when there is no session", async () => {
    stubSession(null);
    const ctx = buildContext("https://apps.no-tone.com/");
    const res = await onRequest(ctx as never, next);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://apps.no-tone.com/login");
  });

  it("preserves the original path as a redirect param for deep links", async () => {
    stubSession(null);
    const ctx = buildContext("https://apps.no-tone.com/some-page");
    const res = await onRequest(ctx as never, next);
    const location = new URL(res.headers.get("Location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/some-page");
  });

  it("treats a failed get-session call as unauthenticated rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const ctx = buildContext("https://apps.no-tone.com/");
    const res = await onRequest(ctx as never, next);
    expect(res.status).toBe(302);
  });

  it("treats a non-2xx get-session response as unauthenticated", async () => {
    stubSession(null, false);
    const ctx = buildContext("https://apps.no-tone.com/");
    const res = await onRequest(ctx as never, next);
    expect(res.status).toBe(302);
  });
});
