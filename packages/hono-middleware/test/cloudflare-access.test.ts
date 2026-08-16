import { Hono } from "hono";
import { sign } from "hono/jwt";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireCloudflareAccess } from "../src/cloudflare-access";

const TEAM_DOMAIN = "example.cloudflareaccess.com";
const ISSUER = `https://${TEAM_DOMAIN}`;
const AUD = "test-aud";
const KID = "test-kid";

async function generateSignedToken(payload: Record<string, unknown>) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"],
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  const token = await sign(
    payload,
    { ...privateJwk, alg: "RS256", kid: KID },
    "RS256",
  );
  const jwks = { keys: [{ ...publicJwk, alg: "RS256", kid: KID, use: "sig" }] };
  return { token, jwks };
}

function buildApp() {
  const app = new Hono();
  app.use("*", requireCloudflareAccess({ teamDomain: TEAM_DOMAIN, aud: AUD }));
  app.get("/protected", (c) => c.text("ok"));
  return app;
}

describe("requireCloudflareAccess", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects requests missing the Access JWT header", async () => {
    const res = await buildApp().request("/protected");
    expect(res.status).toBe(401);
  });

  it("rejects a token that fails verification", async () => {
    const res = await buildApp().request("/protected", {
      headers: { "Cf-Access-Jwt-Assertion": "not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });

  it("allows a request bearing a validly-signed Access JWT", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { token, jwks } = await generateSignedToken({
      iss: ISSUER,
      aud: AUD,
      iat: now,
      exp: now + 3600,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200 })),
    );

    const res = await buildApp().request("/protected", {
      headers: { "Cf-Access-Jwt-Assertion": token },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("rejects a validly-signed token for the wrong audience", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { token, jwks } = await generateSignedToken({
      iss: ISSUER,
      aud: "some-other-aud",
      iat: now,
      exp: now + 3600,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200 })),
    );

    const res = await buildApp().request("/protected", {
      headers: { "Cf-Access-Jwt-Assertion": token },
    });
    expect(res.status).toBe(401);
  });
});
