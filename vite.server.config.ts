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
  define: {
    "process.env.WS_NO_BUFFER_UTIL": JSON.stringify("true"),
    "process.env.WS_NO_UTF_8_VALIDATE": JSON.stringify("true"),
  },
  ssr: {
    noExternal: true,
  },
});
