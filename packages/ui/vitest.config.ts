import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text-summary"],
      thresholds: {
        statements: 65,
        branches: 50,
        functions: 65,
        lines: 65,
      },
    },
  },
});
