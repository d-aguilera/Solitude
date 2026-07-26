import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  cacheDir: fileURLToPath(
    new URL("../../node_modules/.vite/standalone-pack-v1", import.meta.url),
  ),
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        memory: fileURLToPath(
          new URL("./src/memory/index.ts", import.meta.url),
        ),
        pause: fileURLToPath(new URL("./src/pause/index.ts", import.meta.url)),
        playback: fileURLToPath(
          new URL("./src/playback/index.ts", import.meta.url),
        ),
        "time-scale": fileURLToPath(
          new URL("./src/time-scale/index.ts", import.meta.url),
        ),
        profiling: fileURLToPath(
          new URL("./src/profiling/index.ts", import.meta.url),
        ),
        ships: fileURLToPath(new URL("./src/ships/index.ts", import.meta.url)),
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
              host: "browser",
              id: "standalone-pack-v1",
              plugins: [
                "./ships/plugin.json",
                "./playback/plugin.json",
                "./pause/plugin.json",
                "./time-scale/plugin.json",
                "./memory/plugin.json",
                "./profiling/plugin.json",
                "./operator-switch/plugin.json",
              ],
              schemaVersion: 3,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "ships/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "ships",
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "playback/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "playback",
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "profiling/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "profiling",
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "memory/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "memory",
              schemaVersion: 2,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "pause/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "pause",
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
        this.emitFile({
          fileName: "time-scale/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: SOLITUDE_PLUGIN_API_VERSION,
              entry: "./index.js",
              id: "timeScale",
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
