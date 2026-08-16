export type TileStatus = "up" | "down" | "vpn" | "checking" | "unknown";
export type ServerAppStatus = "up" | "down" | "unknown";

interface ResolveTileStatusInput {
  isSelfHosted: boolean;
  serverStatus: ServerAppStatus | undefined;
  tailnetDeviceOnline: boolean | null;
  /** null when no browser ping was performed (short-circuited by an earlier signal). */
  pingOk: boolean | null;
  onTailnet: boolean;
}

/**
 * Combines apps/api's server-side probe, the (optional) Tailscale device
 * status, and the visitor's own browser ping into a single tile status. Pure
 * logic extracted from main-menu's inline checkStatuses() so it can be unit
 * tested directly against the resolution table documented in the original
 * README:
 *
 * - Worker says `up` -> tile is `up`.
 * - Self-hosted + OAuth device offline -> tile is `down`.
 * - Browser ping succeeds -> tile is `up`.
 * - Public + ping fails -> tile is `down`.
 * - Self-hosted + ping fails + visitor on tailnet -> tile is `down`.
 * - Self-hosted + ping fails + visitor not on tailnet -> tile is `vpn`.
 */
export function resolveTileStatus(input: ResolveTileStatusInput): TileStatus {
  if (input.serverStatus === "up") return "up";
  if (input.isSelfHosted && input.tailnetDeviceOnline === false) return "down";
  if (!input.isSelfHosted) return input.pingOk ? "up" : "down";
  if (input.pingOk) return "up";
  return input.onTailnet ? "down" : "vpn";
}

/** Whether a browser ping is needed at all, given the signals already known. */
export function needsPing(
  input: Pick<
    ResolveTileStatusInput,
    "isSelfHosted" | "serverStatus" | "tailnetDeviceOnline"
  >,
): boolean {
  if (input.serverStatus === "up") return false;
  if (input.isSelfHosted && input.tailnetDeviceOnline === false) return false;
  return true;
}
