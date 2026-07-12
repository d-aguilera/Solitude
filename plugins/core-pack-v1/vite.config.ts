import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        "orbit-segments": fileURLToPath(
          new URL("./src/orbit-segments/index.ts", import.meta.url),
        ),
        "targeting-laser": fileURLToPath(
          new URL("./src/targeting-laser/index.ts", import.meta.url),
        ),
        "velocity-segments": fileURLToPath(
          new URL("./src/velocity-segments/index.ts", import.meta.url),
        ),
      },
      formats: ["es"],
    },
    minify: false,
    outDir: fileURLToPath(
      new URL("../../dist/plugin-packages/core-pack-v1", import.meta.url),
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
              id: "core-pack-v1",
              plugins: [
                "./orbit-segments/plugin.json",
                "./targeting-laser/plugin.json",
                "./velocity-segments/plugin.json",
              ],
              schemaVersion: 1,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "orbit-segments/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: 1,
              entry: "./index.js",
              environment: "browser",
              id: "orbitSegments",
              schemaVersion: 1,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "targeting-laser/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: 1,
              entry: "./index.js",
              environment: "browser",
              id: "targetingLaser",
              schemaVersion: 1,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
        this.emitFile({
          fileName: "velocity-segments/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: 1,
              entry: "./index.js",
              environment: "browser",
              id: "velocitySegments",
              schemaVersion: 1,
            },
            null,
            2,
          )}\n`,
          type: "asset",
        });
      },
      name: "core-pack-v1-manifests",
    },
  ],
  root: pluginRoot,
});
