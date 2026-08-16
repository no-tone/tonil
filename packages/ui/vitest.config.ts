import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No pure-JS logic to unit test yet — this package is Astro components +
    // CSS tokens. Astro component rendering tests belong in the app that
    // consumes them (apps/web, apps/dashboard), which have real pages to
    // render against.
    passWithNoTests: true,
  },
});
