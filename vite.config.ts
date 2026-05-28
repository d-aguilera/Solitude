import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const solitudeRoot = resolve("packages/solitude");

export default defineConfig({
  root: solitudeRoot,
  build: {
    emptyOutDir: true,
    outDir: "../../dist",
    rollupOptions: {
      input: {
        index: resolve(solitudeRoot, "index.html"),
      },
    },
  },
  test: {
    include: ["../**/*.test.ts", "../**/*.spec.ts"],
    exclude: ["dist", "node_modules", "**/dist/**", "**/node_modules/**"],
  },
});
