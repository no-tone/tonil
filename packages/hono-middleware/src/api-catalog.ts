import type { MiddlewareHandler } from "hono";
import { type ApiCatalogEntryInput, buildApiCatalogBody } from "./core";

export type ApiCatalogEntry = ApiCatalogEntryInput;

export interface ApiCatalogOptions {
  /** Defaults to "/.well-known/api-catalog". */
  path?: string;
  entries: ApiCatalogEntry[];
}

/** Serves an RFC 9727 API catalog (linkset+json) describing this app's public API surface. */
export function apiCatalog(options: ApiCatalogOptions): MiddlewareHandler {
  const path = options.path ?? "/.well-known/api-catalog";
  const body = buildApiCatalogBody(options.entries);

  return async (c, next) => {
    if (new URL(c.req.url).pathname !== path) {
      await next();
      return;
    }
    return c.body(body, 200, {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    });
  };
}
