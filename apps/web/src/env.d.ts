/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

// BaseHead.astro (from @repo/ui) reads Astro.locals.cspNonce, set by our own
// src/middleware.ts (via @repo/hono-middleware/core's buildSecurityHeaders).
// TypeScript ambient declarations don't cross package boundaries on their
// own, so this app needs the same augmentation packages/ui/src/env.d.ts has.
declare namespace App {
  interface Locals extends Runtime {
    cspNonce: string;
  }
}
