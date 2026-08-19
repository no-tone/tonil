// @ts-check

import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://no-tone.com",
  security: {
    allowedDomains: [
      {
        hostname: "no-tone.com",
        protocol: "https",
      },
      {
        hostname: "**.no-tone.com",
        protocol: "https",
      },
    ],
  },
  output: "server",
  // Every route is public now that /v2 has become the site, so there is
  // nothing left to filter out.
  //
  // `serialize` strips the trailing slash Astro adds by default. The site's
  // own navigation, its canonical tags and the redirect in src/middleware.ts
  // all use the bare form, and a sitemap that advertises the other one sends
  // every crawler through a redirect to find out.
  //
  // Not `trailingSlash: "never"`: that makes Astro's router refuse /cv/
  // outright, turning duplicate content into a 404 for anyone following an
  // older link. Serving both and redirecting one loses nothing.
  integrations: [
    sitemap({
      serialize: (item) => ({
        ...item,
        url: item.url.replace(/(.)\/$/, "$1"),
      }),
    }),
  ],
  adapter: cloudflare({
    imageService: "compile",
  }),
});
