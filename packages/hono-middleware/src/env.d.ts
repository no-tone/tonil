/// <reference types="astro/client" />

// astro-security.ts sets Astro.locals.cspNonce; consuming apps (apps/web,
// apps/dashboard) declare the same augmentation in their own env.d.ts — see
// packages/ui/src/env.d.ts for the fuller explanation of why this doesn't
// cross package boundaries automatically.
declare namespace App {
  interface Locals {
    cspNonce: string;
  }
}
