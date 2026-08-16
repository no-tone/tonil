export interface Bindings extends CloudflareBindings {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_API_KEY?: string;
  GITHUB_TOKEN?: string;
  TAILSCALE_OAUTH_CLIENT_ID?: string;
  TAILSCALE_OAUTH_CLIENT_SECRET?: string;
  TAILSCALE_OAUTH_SCOPE?: string;
  TAILSCALE_TAILNET?: string;
  TAILSCALE_STATUS_DEVICE?: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    cspNonce: string;
  };
}
