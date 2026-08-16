import {
  fetchWithTimeout,
  resolveProbePath,
  type SelfHostedApp,
} from "@repo/content";
import type { Bindings } from "../env";

type HealthStatus = "up" | "down" | "unknown";

const PROBE_TIMEOUT_MS = 2500;

export async function probeAppHealth(href: string): Promise<HealthStatus> {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return "unknown";
  }

  try {
    const response = await fetchWithTimeout(
      new URL(resolveProbePath(url), url),
      PROBE_TIMEOUT_MS,
      { cache: "no-store", redirect: "manual" },
    );
    return response.status < 500 ? "up" : "down";
  } catch {
    return "down";
  }
}

interface AppHealth {
  name: string;
  href: string;
  status: HealthStatus;
}

export async function probeAllApps(
  apps: SelfHostedApp[],
): Promise<AppHealth[]> {
  return Promise.all(
    apps.map(async (app) => ({
      name: app.name,
      href: app.href,
      status: await probeAppHealth(app.href),
    })),
  );
}

interface TailnetDevice {
  name: string;
  online: boolean;
  lastSeen: string | null;
}

interface RawTailnetDevice {
  name?: string;
  hostname?: string;
  addresses?: string[];
  online?: boolean;
  lastSeen?: string;
}

const TAILSCALE_TOKEN_URL = "https://api.tailscale.com/api/v2/oauth/token";

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

async function getTailscaleToken(env: Bindings): Promise<string | null> {
  const clientId = env.TAILSCALE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.TAILSCALE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: env.TAILSCALE_OAUTH_SCOPE?.trim() || "devices:core:read",
  });

  const response = await fetch(TAILSCALE_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: basicAuth(clientId, clientSecret),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export function findTailnetDevice(
  devices: RawTailnetDevice[],
  target: string,
): RawTailnetDevice | null {
  const needle = target.trim().toLowerCase();
  if (!needle) return null;
  return (
    devices.find((device) => {
      const names = [
        device.hostname,
        device.name,
        ...(device.addresses ?? []),
      ].filter(Boolean);
      return names.some((name) => {
        const value = String(name).toLowerCase();
        return value === needle || value.startsWith(`${needle}.`);
      });
    }) ?? null
  );
}

export async function getTailnetDevice(
  env: Bindings,
): Promise<TailnetDevice | null> {
  const tailnet = env.TAILSCALE_TAILNET?.trim();
  const target = env.TAILSCALE_STATUS_DEVICE?.trim();
  if (!tailnet || !target) return null;

  const token = await getTailscaleToken(env);
  if (!token) return null;

  const response = await fetch(
    `https://api.tailscale.com/api/v2/tailnet/${encodeURIComponent(tailnet)}/devices`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok) return null;

  const data = (await response.json()) as { devices?: RawTailnetDevice[] };
  const device = findTailnetDevice(data.devices ?? [], target);
  if (!device) return null;

  return {
    name: device.hostname ?? device.name ?? target,
    online: Boolean(device.online),
    lastSeen: device.lastSeen ?? null,
  };
}
