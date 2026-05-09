import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "packages/solitude",
  build: {
    emptyOutDir: true,
    outDir: "../../dist",
  },
  test: {
    include: ["../**/*.test.ts", "../**/*.spec.ts"],
    exclude: ["dist", "node_modules", "**/dist/**", "**/node_modules/**"],
  },
});
