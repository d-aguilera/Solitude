import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        "operator-switch": fileURLToPath(
          new URL("./src/operator-switch/index.ts", import.meta.url),
        ),
      },
      formats: ["es"],
    },
    minify: false,
    outDir: fileURLToPath(
      new URL("../../dist/plugin-packages/standalone-pack-v1", import.meta.url),
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
              hosts: ["browser"],
              id: "standalone-pack-v1",
              plugins: ["./operator-switch/plugin.json"],
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "operator-switch/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "operatorSwitch",
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
      },
      name: "standalone-pack-v1-manifests",
    },
  ],
  root: pluginRoot,
});
