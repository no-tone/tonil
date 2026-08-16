import type { MiddlewareHandler } from "hono";

export interface MarkdownNegotiationOptions {
  /** Defaults to "/". */
  path?: string;
  markdown: string | (() => string);
}

/**
 * Content-negotiates `Accept: text/markdown` on a given path (default "/") so
 * agents/LLMs get a machine-readable page while browsers get the normal app.
 */
export function markdownNegotiation(
  options: MarkdownNegotiationOptions,
): MiddlewareHandler {
  const path = options.path ?? "/";

  return async (c, next) => {
    const url = new URL(c.req.url);
    const accept = c.req.header("Accept") || "";
    if (url.pathname === path && accept.includes("text/markdown")) {
      const body =
        typeof options.markdown === "function"
          ? options.markdown()
          : options.markdown;
      return c.body(body, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
        Vary: "Accept",
      });
    }
    await next();
  };
}
