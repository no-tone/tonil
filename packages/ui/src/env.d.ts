/// <reference types="astro/client" />

// BaseHead.astro reads Astro.locals.cspNonce, set by each app's own
// src/middleware.ts (via @repo/hono-middleware/core's buildSecurityHeaders).
// Consuming apps (apps/web, apps/dashboard) need the same augmentation in
// their own env.d.ts - TypeScript ambient declarations don't cross package
// boundaries on their own.
declare namespace App {
  interface Locals {
    cspNonce: string;
  }
}
