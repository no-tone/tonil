import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      enabled: true,
      // v8's coverage API isn't available inside workerd, so this pool needs
      // istanbul's source instrumentation instead - see
      // @cloudflare/vitest-pool-workers' own test suite, which does the same.
      provider: "istanbul",
      reporter: ["text-summary"],
      thresholds: {
        statements: 70,
        branches: 45,
        functions: 75,
        lines: 70,
      },
    },
  },
});
