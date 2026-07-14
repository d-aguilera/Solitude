import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        "remote-identity-hud": fileURLToPath(
          new URL("./src/remote-identity-hud/index.ts", import.meta.url),
        ),
        "ship-color-names": fileURLToPath(
          new URL("./src/ship-color-names/index.ts", import.meta.url),
        ),
      },
      formats: ["es"],
    },
    minify: false,
    outDir: fileURLToPath(
      new URL(
        "../../dist/plugin-packages/multiplayer-pack-v1",
        import.meta.url,
      ),
    ),
    rollupOptions: {
      output: {
        chunkFileNames: "shared/[name]-[hash].js",
        entryFileNames: "[name]/index.js",
      },
    },
  },
  plugins: [
    {
      generateBundle() {
        this.emitFile({
          fileName: "pack.json",
          source: `${JSON.stringify(
            {
              id: "multiplayer-pack-v1",
              plugins: [
                "./remote-identity-hud/plugin.json",
                "./ship-color-names/plugin.json",
              ],
              schemaVersion: 1,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "remote-identity-hud/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              environment: "browser",
              id: "remoteIdentityHud",
              schemaVersion: 1,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "ship-color-names/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              environment: "browser",
              id: "shipColorNames",
              schemaVersion: 1,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
      },
      name: "multiplayer-pack-v1-manifests",
    },
  ],
  root: pluginRoot,
});
