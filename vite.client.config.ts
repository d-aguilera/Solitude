import { resolve } from "node:path";
import { defineConfig } from "vite";

const clientRoot = resolve("packages/client");

export default defineConfig({
  cacheDir: resolve("node_modules/.vite/client"),
  root: clientRoot,
  publicDir: resolve("dist/plugin-public/multiplayer"),
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
