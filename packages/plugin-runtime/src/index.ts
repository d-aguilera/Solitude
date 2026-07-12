import type {
  GamePlugin,
  MarkerPlugin,
  PluginCatalog,
  PluginFactory,
  SegmentPlugin,
} from "@solitude/engine/plugin";
import {
  SOLITUDE_PLUGIN_API_VERSION,
  type ExternalPlugin,
  type ExternalPluginEnvironment,
  type ExternalPluginManifest,
  type ExternalPluginModule,
  type ExternalPluginPackManifest,
  type ExternalPluginSetManifest,
} from "@solitude/plugin-api";

const PLUGIN_MANIFEST_SCHEMA_VERSION = 1;
const PLUGIN_PACK_SCHEMA_VERSION = 1;
const PLUGIN_SET_SCHEMA_VERSION = 1;
const PLUGIN_ID_PATTERN = /^[A-Za-z][A-Za-z0-9.-]*$/;

export interface ExternalPluginSet {
  catalog: PluginCatalog;
  ids: readonly string[];
}

export interface ExternalPluginSetLoadAdapters {
  fetchJson: (url: string) => Promise<unknown>;
  importModule: (url: string) => Promise<unknown>;
}

export interface ExternalPluginSetLoadOptions extends ExternalPluginSetLoadAdapters {
  environment: ExternalPluginEnvironment;
  pluginSetUrl: string;
}

export interface ComposedPluginSet {
  catalog: PluginCatalog;
  ids: readonly string[];
}

export async function loadBrowserPluginSet(
  pluginSetUrl: string,
): Promise<ExternalPluginSet> {
  return loadExternalPluginSet({
    environment: "browser",
    fetchJson: fetchJsonFromNetwork,
    importModule: importExternalModule,
    pluginSetUrl,
  });
}

export async function loadExternalPluginSet({
  environment,
  fetchJson,
  importModule,
  pluginSetUrl,
}: ExternalPluginSetLoadOptions): Promise<ExternalPluginSet> {
  const absoluteSetUrl = new URL(pluginSetUrl, globalThis.location?.href).href;
  const pluginSet = parsePluginSetManifest(
    await fetchJson(absoluteSetUrl),
    absoluteSetUrl,
  );
  const packManifestUrls = pluginSet.packs.map(
    (packManifestUrl) => new URL(packManifestUrl, absoluteSetUrl).href,
  );
  const packManifests = await Promise.all(
    packManifestUrls.map(async (packManifestUrl) =>
      parsePluginPackManifest(
        await fetchJson(packManifestUrl),
        packManifestUrl,
      ),
    ),
  );
  validatePluginPacks(packManifests);
  const manifestUrls = packManifests.flatMap((pack, index) =>
    pack.plugins.map(
      (manifestUrl) => new URL(manifestUrl, packManifestUrls[index]).href,
    ),
  );
  const manifests = await Promise.all(
    manifestUrls.map(async (manifestUrl) =>
      parsePluginManifest(await fetchJson(manifestUrl), manifestUrl),
    ),
  );

  validatePluginManifests(manifests, manifestUrls, environment);

  const modules = await Promise.all(
    manifests.map((manifest, index) =>
      importModule(new URL(manifest.entry, manifestUrls[index]).href),
    ),
  );
  const catalog: Record<string, PluginFactory> = Object.create(null) as Record<
    string,
    PluginFactory
  >;

  for (let index = 0; index < manifests.length; index++) {
    const manifest = manifests[index];
    const module = parsePluginModule(modules[index], manifest.id);
    catalog[manifest.id] = createInternalPluginFactory(manifest.id, module);
  }

  return {
    catalog,
    ids: manifests.map(({ id }) => id),
  };
}

export function appendExternalPluginSet(
  baseCatalog: PluginCatalog,
  baseIds: readonly string[],
  external: ExternalPluginSet,
): ComposedPluginSet {
  const duplicateId = external.ids.find((id) => baseCatalog[id] !== undefined);
  if (duplicateId) {
    throw new Error(
      `External plugin id collides with host plugin: ${duplicateId}`,
    );
  }
  return {
    catalog: { ...baseCatalog, ...external.catalog },
    ids: [...baseIds, ...external.ids],
  };
}

function parsePluginSetManifest(
  value: unknown,
  source: string,
): ExternalPluginSetManifest {
  if (!isRecord(value)) throw invalidManifest("plugin set", source);
  if (value.schemaVersion !== PLUGIN_SET_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported plugin set schema at ${source}: ${String(value.schemaVersion)}`,
    );
  }
  if (
    !Array.isArray(value.packs) ||
    !value.packs.every((item) => typeof item === "string" && item.length > 0)
  ) {
    throw invalidManifest("plugin set", source);
  }
  return value as unknown as ExternalPluginSetManifest;
}

function parsePluginPackManifest(
  value: unknown,
  source: string,
): ExternalPluginPackManifest {
  if (!isRecord(value)) throw invalidManifest("plugin pack", source);
  if (value.schemaVersion !== PLUGIN_PACK_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported plugin pack schema at ${source}: ${String(value.schemaVersion)}`,
    );
  }
  if (
    typeof value.id !== "string" ||
    !PLUGIN_ID_PATTERN.test(value.id) ||
    !Array.isArray(value.plugins) ||
    !value.plugins.every((item) => typeof item === "string" && item.length > 0)
  ) {
    throw invalidManifest("plugin pack", source);
  }
  return value as unknown as ExternalPluginPackManifest;
}

function validatePluginPacks(
  manifests: readonly ExternalPluginPackManifest[],
): void {
  const ids = new Set<string>();
  for (const manifest of manifests) {
    if (ids.has(manifest.id)) {
      throw new Error(`Duplicate external plugin pack id: ${manifest.id}`);
    }
    ids.add(manifest.id);
  }
}

function parsePluginManifest(
  value: unknown,
  source: string,
): ExternalPluginManifest {
  if (!isRecord(value)) throw invalidManifest("plugin", source);
  if (value.schemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported plugin manifest schema at ${source}: ${String(value.schemaVersion)}`,
    );
  }
  if (
    typeof value.apiVersion !== "number" ||
    typeof value.entry !== "string" ||
    value.entry.length === 0 ||
    (value.environment !== "browser" && value.environment !== "server") ||
    typeof value.id !== "string" ||
    !PLUGIN_ID_PATTERN.test(value.id)
  ) {
    throw invalidManifest("plugin", source);
  }
  return value as unknown as ExternalPluginManifest;
}

function validatePluginManifests(
  manifests: readonly ExternalPluginManifest[],
  manifestUrls: readonly string[],
  environment: ExternalPluginEnvironment,
): void {
  const ids = new Set<string>();
  for (let index = 0; index < manifests.length; index++) {
    const manifest = manifests[index];
    if (manifest.apiVersion !== SOLITUDE_PLUGIN_API_VERSION) {
      throw new Error(
        `Unsupported plugin API for ${manifest.id} at ${manifestUrls[index]}: ${manifest.apiVersion}`,
      );
    }
    if (manifest.environment !== environment) {
      throw new Error(
        `Plugin ${manifest.id} targets ${manifest.environment}, not ${environment}`,
      );
    }
    if (ids.has(manifest.id)) {
      throw new Error(`Duplicate external plugin id: ${manifest.id}`);
    }
    ids.add(manifest.id);
  }
}

function parsePluginModule(value: unknown, id: string): ExternalPluginModule {
  if (!isRecord(value) || typeof value.createPlugin !== "function") {
    throw new Error(`External plugin ${id} does not export createPlugin`);
  }
  return value as unknown as ExternalPluginModule;
}

function createInternalPluginFactory(
  expectedId: string,
  module: ExternalPluginModule,
): PluginFactory {
  return (runtimeOptions) => {
    const external = module.createPlugin(runtimeOptions);
    validateExternalPlugin(external, expectedId);
    return adaptExternalPlugin(external);
  };
}

function validateExternalPlugin(
  plugin: ExternalPlugin,
  expectedId: string,
): void {
  if (!isRecord(plugin) || plugin.id !== expectedId) {
    throw new Error(
      `External plugin factory for ${expectedId} returned id ${String(plugin?.id)}`,
    );
  }
  if (plugin.capabilities && !Array.isArray(plugin.capabilities)) {
    throw new Error(`External plugin ${expectedId} has invalid capabilities`);
  }
  if (
    plugin.markers?.appendMarkers !== undefined &&
    typeof plugin.markers.appendMarkers !== "function"
  ) {
    throw new Error(`External plugin ${expectedId} has invalid markers`);
  }
  if (
    plugin.segments?.appendSegments !== undefined &&
    typeof plugin.segments.appendSegments !== "function"
  ) {
    throw new Error(`External plugin ${expectedId} has invalid segments`);
  }
}

function adaptExternalPlugin(plugin: ExternalPlugin): GamePlugin {
  return {
    id: plugin.id,
    capabilities: plugin.capabilities,
    markers: plugin.markers as MarkerPlugin | undefined,
    requirements: plugin.requirements,
    segments: plugin.segments as SegmentPlugin | undefined,
  };
}

async function fetchJsonFromNetwork(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch plugin document ${url}: ${response.status}`,
    );
  }
  return response.json() as Promise<unknown>;
}

function importExternalModule(url: string): Promise<unknown> {
  return import(/* @vite-ignore */ url) as Promise<unknown>;
}

function invalidManifest(kind: string, source: string): Error {
  return new Error(`Invalid ${kind} manifest: ${source}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
