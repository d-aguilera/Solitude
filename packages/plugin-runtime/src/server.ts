import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  loadExternalPluginSet,
  type ExternalPluginDocumentKind,
  type ExternalPluginSet,
} from "./index";

export async function loadServerPluginSet(
  pluginSetPath: string,
): Promise<ExternalPluginSet> {
  const pluginSetFilename = await realpath(resolve(pluginSetPath));
  const pluginRoot = dirname(pluginSetFilename);
  const pluginSetUrl = pathToFileURL(pluginSetFilename).href;

  return loadExternalPluginSet({
    assertUrl: (url, kind) => assertLocalPluginUrl(url, pluginRoot, kind),
    fetchJson: async (url, kind) => {
      const filename = await resolveContainedPluginFile(url, pluginRoot, kind);
      const source = await readFile(filename, "utf8");
      try {
        return JSON.parse(source) as unknown;
      } catch {
        throw new Error(`Invalid JSON in server plugin document: ${filename}`);
      }
    },
    host: "server",
    importModule: async (url) => {
      const filename = await resolveContainedPluginFile(
        url,
        pluginRoot,
        "plugin module",
      );
      return import(
        /* @vite-ignore */ pathToFileURL(filename).href
      ) as Promise<unknown>;
    },
    pluginSetUrl,
  });
}

function assertLocalPluginUrl(
  value: string,
  pluginRoot: string,
  kind: ExternalPluginDocumentKind,
): void {
  const url = new URL(value);
  if (
    url.protocol !== "file:" ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(`Server ${kind} must be a local file: ${value}`);
  }
  assertContainedPath(fileURLToPath(url), pluginRoot, kind);
}

async function resolveContainedPluginFile(
  value: string,
  pluginRoot: string,
  kind: ExternalPluginDocumentKind,
): Promise<string> {
  assertLocalPluginUrl(value, pluginRoot, kind);
  const filename = await realpath(fileURLToPath(value));
  assertContainedPath(filename, pluginRoot, kind);
  return filename;
}

function assertContainedPath(
  filename: string,
  directory: string,
  kind: ExternalPluginDocumentKind,
): void {
  const relativeFilename = relative(directory, filename);
  if (
    relativeFilename === ".." ||
    relativeFilename.startsWith("../") ||
    relativeFilename.startsWith("..\\") ||
    isAbsolute(relativeFilename)
  ) {
    throw new Error(`Server ${kind} escapes plugin root: ${filename}`);
  }
}
