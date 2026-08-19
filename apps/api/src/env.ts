export interface Bindings extends CloudflareBindings {
  GITHUB_TOKEN?: string;
  TAILSCALE_OAUTH_CLIENT_ID?: string;
  TAILSCALE_OAUTH_CLIENT_SECRET?: string;
  TAILSCALE_OAUTH_SCOPE?: string;
  TAILSCALE_TAILNET?: string;
  TAILSCALE_STATUS_DEVICE?: string;
  /** Bearer token apps/ssh-cv presents to POST /ssh/authorize. */
  SSH_GATEWAY_TOKEN?: string;
  /** Newline-separated allowlist; see services/ssh-allowlist.ts for the format. */
  SSH_AUTHORIZED_KEYS?: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    cspNonce: string;
  };
}
