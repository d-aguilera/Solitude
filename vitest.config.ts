import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.spec.ts",
      "plugins/**/*.test.ts",
      "plugins/**/*.spec.ts",
    ],
    exclude: ["dist", "node_modules", "**/dist/**", "**/node_modules/**"],
  },
});
