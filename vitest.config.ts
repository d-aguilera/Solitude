import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: resolve("node_modules/.vite/vitest"),
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
