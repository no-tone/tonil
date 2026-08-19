// @ts-check

import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://dash.no-tone.com",
  output: "server",
  integrations: [],
  // No `image` config and no imageService override: nothing in this app uses
  // astro:assets any more. The app icons are remote .webp files served by a
  // CDN and are requested by the browser directly (see index.astro), so
  // there is no image pipeline left to configure.
  adapter: cloudflare(),
});
