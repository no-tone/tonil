export {
  type ApiCatalogEntry,
  type ApiCatalogOptions,
  apiCatalog,
} from "./api-catalog";
export {
  type CloudflareAccessOptions,
  requireCloudflareAccess,
} from "./cloudflare-access";
// NOTE: astro-security.ts is intentionally NOT re-exported here - it's the
// one file in this package that's Astro-specific (types against Astro's
// MiddlewareHandler + App.Locals), and this barrel is also imported by
// apps/api, which has no Astro dependency at all. Astro apps import it via
// the explicit subpath instead: `@repo/hono-middleware/astro-security`.
export {
  type ApiCatalogEntryInput,
  type BuildSecurityHeadersOptions,
  type BuiltSecurityHeaders,
  buildApiCatalogBody,
  buildSecurityHeaders,
  DEFAULT_PERMISSIONS_POLICY,
} from "./core";
export { type DevRobotsOptions, devRobots } from "./dev-robots";
export {
  type MarkdownNegotiationOptions,
  markdownNegotiation,
} from "./markdown-negotiation";
export { generateNonce } from "./nonce";
export {
  type ProblemDetails,
  problemDetails,
  problemJson,
  problemResponse,
} from "./problem-json";
export {
  type CspNonceEnv,
  type SecurityHeadersOptions,
  securityHeaders,
} from "./security-headers";
export { type WwwRedirectOptions, wwwRedirect } from "./www-redirect";
