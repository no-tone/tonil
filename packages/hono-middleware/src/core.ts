/**
 * Framework-agnostic building blocks behind the Hono middlewares in this
 * package. Astro apps (which run as their own Cloudflare Worker, outside the
 * Hono API) import these directly from their own `src/middleware.ts` so the
 * security-header/CSP policy has exactly one implementation shared across
 * every app, instead of being reimplemented per framework.
 */

export const DEFAULT_PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "clipboard-read=()",
  "clipboard-write=(self)",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

export interface BuildSecurityHeadersOptions {
  url: URL;
  nonce: string;
  devHostnames?: string[];
  connectSrc?: string[];
  reportPath?: string;
  permissionsPolicy?: string;
  links?: string[];
  /** @default "same-origin" — apps/api sets "cross-origin" since it's deliberately consumed by multiple frontend origins. */
  crossOriginResourcePolicy?: string;
}

export interface BuiltSecurityHeaders {
  isLocalDev: boolean;
  /** Every header except Content-Security-Policy, which is split out since callers often set it last. */
  headers: Record<string, string>;
  csp: string;
}

/** Pure computation of the security-header set + CSP for a given request URL and nonce. */
export function buildSecurityHeaders(
  options: BuildSecurityHeadersOptions,
): BuiltSecurityHeaders {
  const devHostnames = new Set(
    options.devHostnames ?? ["localhost", "127.0.0.1"],
  );
  const connectSrc = ["'self'", ...(options.connectSrc ?? [])].join(" ");
  const reportPath = options.reportPath ?? "/api/csp-report";
  const permissionsPolicy =
    options.permissionsPolicy ?? DEFAULT_PERMISSIONS_POLICY;
  const isLocalDev = devHostnames.has(options.url.hostname);

  const cspReportUrl = new URL(reportPath, options.url).toString();
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": permissionsPolicy,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy":
      options.crossOriginResourcePolicy ?? "same-origin",
    "Cross-Origin-Embedder-Policy": "unsafe-none",
    "X-Frame-Options": "SAMEORIGIN",
    "Reporting-Endpoints": `csp="${cspReportUrl}"`,
  };
  if (options.links?.length) {
    headers.Link = options.links.join(", ");
  }
  if (!isLocalDev) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  const scriptSrc = isLocalDev
    ? "script-src 'self' 'unsafe-inline'"
    : `script-src 'self' 'nonce-${options.nonce}'`;
  const styleSrc = isLocalDev
    ? "style-src 'self' 'unsafe-inline'"
    : `style-src 'self' 'nonce-${options.nonce}'`;

  const directives = [
    "default-src 'none'",
    scriptSrc,
    styleSrc,
    "img-src 'self' https: data:",
    "font-src 'self' https: data:",
    `connect-src ${connectSrc}`,
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    `report-uri ${reportPath}`,
    "report-to csp",
  ];
  if (!isLocalDev) {
    directives.push("upgrade-insecure-requests");
  }

  return { isLocalDev, headers, csp: directives.join("; ") };
}

export interface ApiCatalogEntryInput {
  href: string;
  type?: string;
}

/** Pure RFC 9727 linkset+json body builder, shared by the Hono middleware and any Astro app serving its own catalog. */
export function buildApiCatalogBody(entries: ApiCatalogEntryInput[]): string {
  return JSON.stringify({
    linkset: entries.map((entry) => ({
      anchor: entry.href,
      "service-desc": [
        { href: entry.href, type: entry.type ?? "application/json" },
      ],
    })),
  });
}
