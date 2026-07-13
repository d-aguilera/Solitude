import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));
const solarSystemMaterialAssets = [
  "earth-blue-marble-clouds-2048.jpg",
  "earth-blue-marble-land-ocean-ice-8192.jpg",
  "moon-lro-lroc-color-4096.jpg",
] as const;

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        "orbit-segments": fileURLToPath(
          new URL("./src/orbit-segments/index.ts", import.meta.url),
        ),
        "solar-system-materials": fileURLToPath(
          new URL("./src/solar-system-materials/index.ts", import.meta.url),
        ),
        "targeting-laser": fileURLToPath(
          new URL("./src/targeting-laser/index.ts", import.meta.url),
        ),
        trajectories: fileURLToPath(
          new URL("./src/trajectories/index.ts", import.meta.url),
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
      async generateBundle() {
        for (const filename of solarSystemMaterialAssets) {
          this.emitFile({
            fileName: `solar-system-materials/assets/${filename}`,
            source: await readFile(
              fileURLToPath(
                new URL(
                  `./src/solar-system-materials/assets/${filename}`,
                  import.meta.url,
                ),
              ),
            ),
            type: "asset",
          });
        }
        this.emitFile({
          fileName: "pack.json",
          source: `${JSON.stringify(
            {
              id: "core-pack-v1",
              plugins: [
                "./orbit-segments/plugin.json",
                "./solar-system-materials/plugin.json",
                "./targeting-laser/plugin.json",
                "./trajectories/plugin.json",
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
          fileName: "solar-system-materials/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: 1,
              entry: "./index.js",
              environment: "browser",
              id: "solarSystemMaterials",
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
          fileName: "trajectories/plugin.json",
          source: `${JSON.stringify(
            {
              apiVersion: 1,
              entry: "./index.js",
              environment: "browser",
              id: "trajectories",
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
