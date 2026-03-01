import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".", // index.html at root
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "index.html",
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["dist", "node_modules", "**/dist/**", "**/node_modules/**"],
  },
});
