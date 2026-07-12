import { resolve } from "node:path";
import { defineConfig } from "vite";

const clientRoot = resolve("packages/client");

export default defineConfig({
  root: clientRoot,
  publicDir: resolve("dist/plugin-public"),
  build: {
    emptyOutDir: true,
    outDir: "../../dist/client",
    rollupOptions: {
      input: {
        index: resolve(clientRoot, "index.html"),
        game: resolve(clientRoot, "game.html"),
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
