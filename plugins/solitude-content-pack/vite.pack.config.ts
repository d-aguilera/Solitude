import type { ExternalPluginHost } from "@solitude/plugin-api/manifest";
import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginEntries = [
  {
    directory: "solar-system",
    id: "solarSystem",
    source: new URL("../solar-system/src/index.ts", import.meta.url),
  },
  {
    directory: "poly-fighter",
    id: "polyFighter",
    source: new URL("../poly-fighter/src/index.ts", import.meta.url),
  },
] as const;

export function createSolitudeContentPackConfig({
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
        entry: Object.fromEntries(
          pluginEntries.map(({ directory, source }) => [
            directory,
            fileURLToPath(source),
          ]),
        ),
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
                plugins: pluginEntries.map(
                  ({ directory }) => `./${directory}/plugin.json`,
                ),
                schemaVersion: 3,
              },
              null,
              2,
            )}\n`,
            type: "asset",
          });
          for (const { directory, id } of pluginEntries) {
            this.emitFile({
              fileName: `${directory}/plugin.json`,
              source: `${JSON.stringify(
                {
                  apiVersion: SOLITUDE_PLUGIN_API_VERSION,
                  entry: "./index.js",
                  id,
                  schemaVersion: 2,
                },
                null,
                2,
              )}\n`,
              type: "asset",
            });
          }
        },
        name: `${packId}-manifests`,
      },
    ],
    root: fileURLToPath(packRoot),
  });
}
