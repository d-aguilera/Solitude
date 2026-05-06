import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "packages/**/*.test.ts",
      "packages/**/*.spec.ts",
    ],
    exclude: ["dist", "node_modules", "**/dist/**", "**/node_modules/**"],
  },
});
