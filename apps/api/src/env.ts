export interface Bindings extends CloudflareBindings {
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
