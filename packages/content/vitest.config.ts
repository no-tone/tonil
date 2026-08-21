import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text-summary"],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 95,
        lines: 90,
      },
    },
  },
});
