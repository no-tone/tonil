import { describe, expect, it } from "vitest";
import { isTailnetAddress } from "../src/scripts/tailnet";

describe("isTailnetAddress", () => {
  it("returns false for undefined", () => {
    expect(isTailnetAddress(undefined)).toBe(false);
  });

  it("matches the Tailscale IPv6 ULA prefix", () => {
    expect(isTailnetAddress("fd7a:115c:a1e0:1234::1")).toBe(true);
  });

  it("matches the Tailscale CGNAT range 100.64.0.0/10", () => {
    expect(isTailnetAddress("100.64.0.1")).toBe(true);
    expect(isTailnetAddress("100.127.255.255")).toBe(true);
    expect(isTailnetAddress("100.100.1.1")).toBe(true);
  });

  it("rejects addresses outside the CGNAT range", () => {
    expect(isTailnetAddress("100.63.0.1")).toBe(false);
    expect(isTailnetAddress("100.128.0.1")).toBe(false);
    expect(isTailnetAddress("192.168.1.1")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isTailnetAddress("not-an-ip")).toBe(false);
  });
});
