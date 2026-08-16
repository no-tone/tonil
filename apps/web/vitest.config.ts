import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://no-tone.com/",
      },
    },
    setupFiles: ["./test/setup.ts"],
  },
});
