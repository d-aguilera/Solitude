import type { ExternalPluginHost } from "@solitude/plugin-api/manifest";
import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export function createPolyFighterPackConfig({
  host,
  packId,
  packRoot,
}: {
  host: ExternalPluginHost;
  packId: string;
  packRoot: URL;
}) {
  return defineConfig({
    cacheDir: fileURLToPath(
      new URL(`../../node_modules/.vite/${packId}`, packRoot),
    ),
    build: {
      emptyOutDir: true,
      lib: {
        entry: {
          "poly-fighter": fileURLToPath(
            new URL("./src/index.ts", import.meta.url),
          ),
        },
        formats: ["es"],
      },
      minify: false,
      outDir: fileURLToPath(
        new URL(`../../dist/plugin-packages/${packId}`, packRoot),
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
                host,
                id: packId,
                plugins: ["./poly-fighter/plugin.json"],
                schemaVersion: 3,
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
        name: `${packId}-manifests`,
      },
    ],
    root: fileURLToPath(packRoot),
  });
}
