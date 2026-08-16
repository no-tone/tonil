/**
 * Fetches apps/api's /status endpoint (server-side app health + Tailscale
 * device status — see apps/api/src/routes/status.ts). This app no longer
 * runs that probing logic itself; it moved to apps/api so both apps/web and
 * apps/dashboard can share one implementation.
 *
 * NOTE: this always hits the real production API
 * (https://api.no-tone.com/status), even in local `astro dev`. There is no
 * dev proxy for it — known, accepted limitation. Point a local apps/api
 * instance's port here manually if you need to test against it.
 */

import { fetchWithTimeout } from "@repo/content";
import type { ServerAppStatus } from "./status-resolution";

interface ServerStatus {
  apps: Map<string, ServerAppStatus>;
  tailnetDeviceOnline: boolean | null;
}

const STATUS_URL = "https://api.no-tone.com/status";

interface StatusResponseBody {
  apps?: { href: string; status: ServerAppStatus }[];
  tailnet?: { device?: { online?: boolean } };
}

export async function fetchServerStatuses(
  timeoutMs: number,
): Promise<ServerStatus> {
  try {
    const response = await fetchWithTimeout(STATUS_URL, timeoutMs, {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) return { apps: new Map(), tailnetDeviceOnline: null };

    const data = (await response.json()) as StatusResponseBody;
    return {
      apps: new Map((data.apps ?? []).map((app) => [app.href, app.status])),
      tailnetDeviceOnline:
        typeof data.tailnet?.device?.online === "boolean"
          ? data.tailnet.device.online
          : null,
    };
  } catch {
    return { apps: new Map(), tailnetDeviceOnline: null };
  }
}
