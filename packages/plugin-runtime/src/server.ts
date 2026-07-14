import type { ExternalPluginManifest } from "@solitude/plugin-api/manifest";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadExternalPlugins, type ExternalPluginSet } from "./index";

const VIRTUAL_ORIGIN = "https://solitude.server-plugins.invalid";
const VIRTUAL_CONFIG_URL = `${VIRTUAL_ORIGIN}/loader.json`;
const VIRTUAL_SET_URL = `${VIRTUAL_ORIGIN}/plugin-set.json`;
const VIRTUAL_PACK_URL = `${VIRTUAL_ORIGIN}/pack/pack.json`;
const VIRTUAL_MANIFEST_URL = `${VIRTUAL_ORIGIN}/pack/plugin.json`;

export async function loadServerPlugin(
  manifestPath: string,
): Promise<ExternalPluginSet> {
  const manifestFilename = await realpath(resolve(manifestPath));
  const manifestDirectory = dirname(manifestFilename);
  const manifestDocument = JSON.parse(
    await readFile(manifestFilename, "utf8"),
  ) as unknown;

  return loadExternalPlugins({
    configUrl: VIRTUAL_CONFIG_URL,
    fetchJson: async (url) => {
      switch (url) {
        case VIRTUAL_CONFIG_URL:
          return {
            allowedOrigins: ["self"],
            pluginSet: VIRTUAL_SET_URL,
            schemaVersion: 1,
          };
        case VIRTUAL_SET_URL:
          return { packs: [VIRTUAL_PACK_URL], schemaVersion: 1 };
        case VIRTUAL_PACK_URL:
          return {
            hosts: ["server"],
            id: "server-plugin",
            plugins: [VIRTUAL_MANIFEST_URL],
            schemaVersion: 2,
          };
        case VIRTUAL_MANIFEST_URL:
          return manifestDocument;
        default:
          throw new Error(`Unexpected server plugin document URL: ${url}`);
      }
    },
    importModule: async (url) => {
      const manifest = manifestDocument as ExternalPluginManifest;
      const expectedUrl = new URL(manifest.entry, VIRTUAL_MANIFEST_URL).href;
      if (url !== expectedUrl) {
        throw new Error(`Unexpected server plugin module URL: ${url}`);
      }
      const entryFilename = await realpath(
        resolve(manifestDirectory, manifest.entry),
      );
      assertContainedPath(entryFilename, manifestDirectory);
      return import(
        /* @vite-ignore */ pathToFileURL(entryFilename).href
      ) as Promise<unknown>;
    },
    host: "server",
    pageOrigin: VIRTUAL_ORIGIN,
  });
}

function assertContainedPath(filename: string, directory: string): void {
  const relativeFilename = relative(directory, filename);
  if (
    relativeFilename === ".." ||
    relativeFilename.startsWith("../") ||
    relativeFilename.startsWith("..\\") ||
    isAbsolute(relativeFilename)
  ) {
    throw new Error("Server plugin entry escapes its manifest directory");
  }
}
