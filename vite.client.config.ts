import { resolve } from "node:path";
import { defineConfig } from "vite";

const serverClientRoot = resolve("packages/server/client");

export default defineConfig({
  root: serverClientRoot,
  build: {
    emptyOutDir: true,
    outDir: "../../../dist/client",
    rollupOptions: {
      input: {
        lobby: resolve(serverClientRoot, "lobby.html"),
        remote: resolve(serverClientRoot, "remote.html"),
      },
    },
  },
});
