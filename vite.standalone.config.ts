import { resolve } from "node:path";
import { defineConfig } from "vite";

const solitudeRoot = resolve("packages/solitude");

export default defineConfig({
  cacheDir: resolve("node_modules/.vite/standalone-build"),
  root: solitudeRoot,
  publicDir: resolve("dist/plugin-public/standalone"),
  build: {
    emptyOutDir: true,
    outDir: "../../dist/standalone",
    rollupOptions: {
      input: {
        index: resolve(solitudeRoot, "index.html"),
      },
    },
  },
});
