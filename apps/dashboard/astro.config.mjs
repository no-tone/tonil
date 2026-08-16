// @ts-check

import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://dashboard.no-tone.com",
  output: "server",
  image: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/homarr-labs/dashboard-icons/**",
      },
    ],
  },
  integrations: [],
  adapter: cloudflare({
    imageService: "compile",
  }),
});
