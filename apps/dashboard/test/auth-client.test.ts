import { afterEach, describe, expect, it, vi } from "vitest";
import { signInWithEmail, signOut } from "../src/scripts/auth-client";

describe("signInWithEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on a successful sign-in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ token: "t" }), { status: 200 }),
      ),
    );
    const result = await signInWithEmail("a@example.com", "hunter2");
    expect(result).toEqual({ ok: true });
  });

  it("surfaces Better Auth's error message on invalid credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ message: "Invalid email or password" }),
            {
              status: 401,
            },
          ),
      ),
    );
    const result = await signInWithEmail("a@example.com", "wrong");
    expect(result).toEqual({ ok: false, message: "Invalid email or password" });
  });

  it("falls back to a generic message when the error body has none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 401 })),
    );
    const result = await signInWithEmail("a@example.com", "wrong");
    expect(result).toEqual({ ok: false, message: "Wrong email or password." });
  });

  it("reports unreachable instead of throwing when fetch itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const result = await signInWithEmail("a@example.com", "hunter2");
    expect(result).toEqual({
      ok: false,
      message: "Couldn't reach the auth server.",
    });
  });
});

describe("signOut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the sign-out endpoint with credentials included", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await signOut();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.no-tone.com/api/auth/sign-out",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("does not throw when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(signOut()).resolves.toBeUndefined();
  });
});
