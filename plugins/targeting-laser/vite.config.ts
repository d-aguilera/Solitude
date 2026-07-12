import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const pluginRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
    },
    minify: false,
    outDir: fileURLToPath(
      new URL("../../dist/plugin-packages/targeting-laser", import.meta.url),
    ),
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      generateBundle() {
        this.emitFile({
          fileName: "plugin.json",
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
      },
      name: "targeting-laser-manifest",
    },
  ],
  root: pluginRoot,
});
