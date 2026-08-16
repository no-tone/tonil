import { describe, expect, it } from "vitest";
import { needsPing, resolveTileStatus } from "../src/scripts/status-resolution";

// These mirror the resolution table documented in main-menu's README:
// - Worker says `up` -> tile is `up`.
// - Self-hosted + OAuth device offline -> tile is `down`.
// - Browser ping succeeds -> tile is `up`.
// - Public + ping fails -> tile is `down`.
// - Self-hosted + ping fails + visitor on tailnet -> tile is `down`.
// - Self-hosted + ping fails + visitor not on tailnet -> tile is `vpn`.
describe("resolveTileStatus", () => {
  it("is up when the server probe says up, regardless of anything else", () => {
    expect(
      resolveTileStatus({
        isSelfHosted: true,
        serverStatus: "up",
        tailnetDeviceOnline: false,
        pingOk: false,
        onTailnet: false,
      }),
    ).toBe("up");
  });

  it("is down for a self-hosted app when the Tailscale device is confirmed offline", () => {
    expect(
      resolveTileStatus({
        isSelfHosted: true,
        serverStatus: "down",
        tailnetDeviceOnline: false,
        pingOk: null,
        onTailnet: false,
      }),
    ).toBe("down");
  });

  it("is up when the browser ping succeeds, self-hosted or not", () => {
    expect(
      resolveTileStatus({
        isSelfHosted: true,
        serverStatus: "down",
        tailnetDeviceOnline: null,
        pingOk: true,
        onTailnet: false,
      }),
    ).toBe("up");
    expect(
      resolveTileStatus({
        isSelfHosted: false,
        serverStatus: "down",
        tailnetDeviceOnline: null,
        pingOk: true,
        onTailnet: false,
      }),
    ).toBe("up");
  });

  it("is down for a public app when the ping fails", () => {
    expect(
      resolveTileStatus({
        isSelfHosted: false,
        serverStatus: "down",
        tailnetDeviceOnline: null,
        pingOk: false,
        onTailnet: false,
      }),
    ).toBe("down");
  });

  it("is down for a self-hosted app when the ping fails and the visitor is on the tailnet", () => {
    expect(
      resolveTileStatus({
        isSelfHosted: true,
        serverStatus: "down",
        tailnetDeviceOnline: null,
        pingOk: false,
        onTailnet: true,
      }),
    ).toBe("down");
  });

  it("is vpn for a self-hosted app when the ping fails and the visitor is not on the tailnet", () => {
    expect(
      resolveTileStatus({
        isSelfHosted: true,
        serverStatus: "down",
        tailnetDeviceOnline: null,
        pingOk: false,
        onTailnet: false,
      }),
    ).toBe("vpn");
  });
});

describe("needsPing", () => {
  it("is false once the server already says up", () => {
    expect(
      needsPing({
        isSelfHosted: false,
        serverStatus: "up",
        tailnetDeviceOnline: null,
      }),
    ).toBe(false);
  });

  it("is false for a self-hosted app once the tailnet device is confirmed offline", () => {
    expect(
      needsPing({
        isSelfHosted: true,
        serverStatus: "down",
        tailnetDeviceOnline: false,
      }),
    ).toBe(false);
  });

  it("is true otherwise", () => {
    expect(
      needsPing({
        isSelfHosted: true,
        serverStatus: "down",
        tailnetDeviceOnline: null,
      }),
    ).toBe(true);
    expect(
      needsPing({
        isSelfHosted: false,
        serverStatus: "down",
        tailnetDeviceOnline: null,
      }),
    ).toBe(true);
  });
});
