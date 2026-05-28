import { resolve } from "node:path";
import { defineConfig } from "vite";

const solitudeRoot = resolve("packages/solitude");

export default defineConfig({
  root: solitudeRoot,
  build: {
    emptyOutDir: true,
    outDir: "../../dist/client",
    rollupOptions: {
      input: {
        lobby: resolve(solitudeRoot, "lobby.html"),
        remote: resolve(solitudeRoot, "remote.html"),
      },
    },
  },
});
