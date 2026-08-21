import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text-summary"],
      thresholds: {
        statements: 55,
        branches: 75,
        functions: 40,
        lines: 50,
      },
    },
  },
});
