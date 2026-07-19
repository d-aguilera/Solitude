import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  cacheDir: resolve("node_modules/.vite/server"),
  build: {
    // Server plugin assembly owns dist/server/plugins. Preserve it when Vite
    // replaces the server bundle in the same deployment directory.
    emptyOutDir: false,
    minify: false,
    outDir: "dist/server",
    rollupOptions: {
      input: resolve("packages/multiplayer/src/main.ts"),
      output: {
        entryFileNames: "main.js",
      },
    },
    ssr: true,
    target: "node22",
  },
  define: {
    "process.env.WS_NO_BUFFER_UTIL": JSON.stringify("true"),
    "process.env.WS_NO_UTF_8_VALIDATE": JSON.stringify("true"),
  },
  ssr: {
    noExternal: true,
  },
});
