import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  cacheDir: fileURLToPath(
    new URL(
      "../../node_modules/.vite/solitude-content-pack-v1",
      import.meta.url,
    ),
  ),
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        "poly-fighter": fileURLToPath(
          new URL("./src/poly-fighter/index.ts", import.meta.url),
        ),
      },
      formats: ["es"],
    },
    minify: false,
    outDir: fileURLToPath(
      new URL(
        "../../dist/plugin-packages/solitude-content-pack-v1",
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
              hosts: ["browser", "server"],
              id: "solitude-content-pack-v1",
              plugins: ["./poly-fighter/plugin.json"],
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "poly-fighter/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "polyFighter",
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
      },
      name: "solitude-content-pack-v1-manifests",
    },
  ],
  root: pluginRoot,
});
