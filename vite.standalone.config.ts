import { resolve } from "node:path";
import { defineConfig } from "vite";

const solitudeRoot = resolve("packages/solitude");

export default defineConfig({
  root: solitudeRoot,
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
