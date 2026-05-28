import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist/server",
    rollupOptions: {
      input: resolve("packages/server/src/main.ts"),
      output: {
        entryFileNames: "main.js",
      },
    },
    ssr: true,
    target: "node22",
  },
  ssr: {
    noExternal: [
      "@solitude/browser",
      "@solitude/engine",
      "@solitude/protocol",
      "@solitude/server",
      "solitude",
    ],
  },
});
