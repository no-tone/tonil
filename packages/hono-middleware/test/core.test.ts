import { describe, expect, it } from "vitest";
import { buildApiCatalogBody, buildSecurityHeaders } from "../src/core";

describe("buildSecurityHeaders", () => {
  it("builds a nonce'd CSP with the requested connect-src additions", () => {
    const { csp, headers, isLocalDev } = buildSecurityHeaders({
      url: new URL("https://no-tone.com/"),
      nonce: "abc123",
      connectSrc: ["https://api.github.com"],
    });
    expect(isLocalDev).toBe(false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).toContain("connect-src 'self' https://api.github.com");
    expect(headers["Strict-Transport-Security"]).toBeTruthy();
  });

  it("relaxes policy on dev hostnames", () => {
    const { csp, headers, isLocalDev } = buildSecurityHeaders({
      url: new URL("http://localhost:4321/"),
      nonce: "abc123",
    });
    expect(isLocalDev).toBe(true);
    expect(csp).toContain("'unsafe-inline'");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("defaults Cross-Origin-Resource-Policy to same-origin", () => {
    const { headers } = buildSecurityHeaders({
      url: new URL("https://no-tone.com/"),
      nonce: "abc123",
    });
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("allows overriding Cross-Origin-Resource-Policy (apps/api needs cross-origin)", () => {
    const { headers } = buildSecurityHeaders({
      url: new URL("https://api.no-tone.com/"),
      nonce: "abc123",
      crossOriginResourcePolicy: "cross-origin",
    });
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("cross-origin");
  });
});

describe("buildApiCatalogBody", () => {
  it("builds an RFC 9727 linkset for the given entries", () => {
    const body = JSON.parse(
      buildApiCatalogBody([{ href: "https://no-tone.com/api/projects.json" }]),
    );
    expect(body.linkset[0].anchor).toBe(
      "https://no-tone.com/api/projects.json",
    );
  });
});
