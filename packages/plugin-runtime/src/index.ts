import type {
  GamePlugin,
  LoopPlugin,
  LoopUpdateParams,
  LoopUpdateResult,
  MarkerPlugin,
  PluginCatalog,
  PluginFactory,
  SceneLabelPlugin,
  ScenePlugin,
  SegmentPlugin,
  ViewControlPlugin,
  ViewPlugin,
} from "@solitude/engine/plugin";
import { updateFocusContext } from "@solitude/engine/runtime";
import type {
  ExternalLoopPlugin,
  ExternalLoopUpdateParams,
} from "@solitude/plugin-api/loop";
import type {
  ExternalPluginHost,
  ExternalPluginLoaderConfig,
  ExternalPluginManifest,
  ExternalPluginPackManifest,
  ExternalPluginSetManifest,
} from "@solitude/plugin-api/manifest";
import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import type {
  ExternalPlugin,
  ExternalPluginModule,
} from "@solitude/plugin-api/module";

const PLUGIN_MANIFEST_SCHEMA_VERSION = 2;
const PLUGIN_PACK_SCHEMA_VERSION = 2;
const PLUGIN_SET_SCHEMA_VERSION = 1;
const PLUGIN_ID_PATTERN = /^[A-Za-z][A-Za-z0-9.-]*$/;
const PLUGIN_HOSTS = new Set<ExternalPluginHost>(["browser", "server"]);
const PLUGIN_LOADER_CONFIG_KEYS = new Set([
  "allowedOrigins",
  "pluginSet",
  "schemaVersion",
]);
const PLUGIN_MANIFEST_KEYS = new Set([
  "apiVersion",
  "entry",
  "id",
  "schemaVersion",
]);
const PLUGIN_PACK_KEYS = new Set(["hosts", "id", "plugins", "schemaVersion"]);
const PLUGIN_SET_KEYS = new Set(["packs", "schemaVersion"]);
const EXTERNAL_PLUGIN_KEYS = new Set([
  "capabilities",
  "hooks",
  "id",
  "requirements",
]);
const EXTERNAL_PLUGIN_HOOK_KEYS = new Set([
  "labels",
  "loop",
  "markers",
  "scene",
  "segments",
  "viewControls",
  "views",
]);
const EXTERNAL_PLUGIN_REQUIREMENT_KEYS = new Set(["focusEntity"]);
const EXTERNAL_FOCUS_ENTITY_REQUIREMENTS = new Set([
  "collisionSphere",
  "gravityMass",
]);

export interface ExternalPluginSet {
  catalog: PluginCatalog;
  ids: readonly string[];
}

export interface ExternalPluginLoadAdapters {
  fetchJson: (
    url: string,
    kind: ExternalPluginDocumentKind,
  ) => Promise<unknown>;
  importModule: (url: string) => Promise<unknown>;
}

export type ExternalPluginDocumentKind =
  | "plugin loader config"
  | "plugin manifest"
  | "plugin module"
  | "plugin pack manifest"
  | "plugin set";

export interface ExternalPluginLoadOptions extends ExternalPluginLoadAdapters {
  configUrl: string;
  host: ExternalPluginHost;
  pageOrigin: string;
}

export interface ExternalPluginSetLoadOptions extends ExternalPluginLoadAdapters {
  assertUrl: (url: string, kind: ExternalPluginDocumentKind) => void;
  host: ExternalPluginHost;
  pluginSetUrl: string;
}

export interface ComposedPluginSet {
  catalog: PluginCatalog;
  ids: readonly string[];
}

export async function loadBrowserPlugins(
  configUrl: string,
): Promise<ExternalPluginSet> {
  return loadExternalPlugins({
    configUrl,
    host: "browser",
    fetchJson: fetchJsonFromNetwork,
    importModule: importExternalModule,
    pageOrigin: globalThis.location.origin,
  });
}

export async function loadExternalPlugins({
  configUrl,
  host,
  fetchJson,
  importModule,
  pageOrigin,
}: ExternalPluginLoadOptions): Promise<ExternalPluginSet> {
  const normalizedPageOrigin = normalizePageOrigin(pageOrigin);
  const absoluteConfigUrl = new URL(configUrl, `${normalizedPageOrigin}/`).href;
  assertSameOriginUrl(absoluteConfigUrl, normalizedPageOrigin, "loader config");
  const config = parsePluginLoaderConfig(
    await fetchJson(absoluteConfigUrl, "plugin loader config"),
    absoluteConfigUrl,
  );
  const allowedOrigins = resolveAllowedOrigins(
    config.allowedOrigins,
    normalizedPageOrigin,
    absoluteConfigUrl,
  );
  const absoluteSetUrl = new URL(config.pluginSet, absoluteConfigUrl).href;
  assertAllowedUrl(absoluteSetUrl, allowedOrigins, "plugin set");
  return loadExternalPluginSet({
    assertUrl: (url, kind) => assertAllowedUrl(url, allowedOrigins, kind),
    fetchJson,
    host,
    importModule,
    pluginSetUrl: absoluteSetUrl,
  });
}

export async function loadExternalPluginSet({
  assertUrl,
  fetchJson,
  host,
  importModule,
  pluginSetUrl,
}: ExternalPluginSetLoadOptions): Promise<ExternalPluginSet> {
  assertUrl(pluginSetUrl, "plugin set");
  const pluginSet = parsePluginSetManifest(
    await fetchJson(pluginSetUrl, "plugin set"),
    pluginSetUrl,
  );
  const packManifestUrls = pluginSet.packs.map((packManifestUrl) => {
    const url = new URL(packManifestUrl, pluginSetUrl).href;
    assertUrl(url, "plugin pack manifest");
    return url;
  });
  const packManifests = await Promise.all(
    packManifestUrls.map(async (packManifestUrl) =>
      parsePluginPackManifest(
        await fetchJson(packManifestUrl, "plugin pack manifest"),
        packManifestUrl,
      ),
    ),
  );
  validatePluginPacks(packManifests, host);
  const manifestUrls = packManifests.flatMap((pack, index) =>
    pack.plugins.map((manifestUrl) => {
      const url = new URL(manifestUrl, packManifestUrls[index]).href;
      assertUrl(url, "plugin manifest");
      assertContainedUrl(
        url,
        packManifestUrls[index],
        "Plugin manifest escapes its pack directory",
      );
      return url;
    }),
  );
  const manifests = await Promise.all(
    manifestUrls.map(async (manifestUrl) =>
      parsePluginManifest(
        await fetchJson(manifestUrl, "plugin manifest"),
        manifestUrl,
      ),
    ),
  );

  validatePluginManifests(manifests, manifestUrls);

  const moduleUrls = manifests.map((manifest, index) => {
    const url = new URL(manifest.entry, manifestUrls[index]).href;
    assertUrl(url, "plugin module");
    assertContainedUrl(
      url,
      manifestUrls[index],
      `Plugin module for ${manifest.id} escapes its plugin directory`,
    );
    return url;
  });
  const modules = await Promise.all(moduleUrls.map(importModule));
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

function parsePluginLoaderConfig(
  value: unknown,
  source: string,
): ExternalPluginLoaderConfig {
  if (!isRecord(value)) throw invalidManifest("plugin loader config", source);
  if (value.schemaVersion !== 1) {
    throw new Error(
      `Unsupported plugin loader config schema at ${source}: ${String(value.schemaVersion)}`,
    );
  }
  if (
    !hasOnlyKeys(value, PLUGIN_LOADER_CONFIG_KEYS) ||
    !Array.isArray(value.allowedOrigins) ||
    !value.allowedOrigins.every(
      (origin) => typeof origin === "string" && origin.length > 0,
    ) ||
    typeof value.pluginSet !== "string" ||
    value.pluginSet.length === 0
  ) {
    throw invalidManifest("plugin loader config", source);
  }
  return value as unknown as ExternalPluginLoaderConfig;
}

function resolveAllowedOrigins(
  values: readonly string[],
  pageOrigin: string,
  source: string,
): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const value of values) {
    if (value === "self") {
      origins.add(pageOrigin);
      continue;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`Invalid allowed plugin origin at ${source}: ${value}`);
    }
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.pathname !== "/" ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      throw new Error(`Invalid allowed plugin origin at ${source}: ${value}`);
    }
    origins.add(url.origin);
  }
  return origins;
}

function normalizePageOrigin(value: string): string {
  const url = new URL(value);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.origin !== value
  ) {
    throw new Error(`Invalid page origin: ${value}`);
  }
  return url.origin;
}

function assertSameOriginUrl(
  value: string,
  origin: string,
  kind: string,
): void {
  if (new URL(value).origin !== origin) {
    throw new Error(`External ${kind} must be same-origin: ${value}`);
  }
}

function assertAllowedUrl(
  value: string,
  allowedOrigins: ReadonlySet<string>,
  kind: string,
): void {
  const origin = new URL(value).origin;
  if (!allowedOrigins.has(origin)) {
    throw new Error(`Disallowed ${kind} origin: ${origin}`);
  }
}

function assertContainedUrl(
  value: string,
  containerDocumentUrl: string,
  message: string,
): void {
  const candidate = new URL(value);
  const containerDirectory = new URL("./", containerDocumentUrl);
  if (
    candidate.protocol !== containerDirectory.protocol ||
    candidate.host !== containerDirectory.host ||
    !candidate.pathname.startsWith(containerDirectory.pathname)
  ) {
    throw new Error(`${message}: ${value}`);
  }
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
    !hasOnlyKeys(value, PLUGIN_SET_KEYS) ||
    !Array.isArray(value.packs) ||
    value.packs.length === 0 ||
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
    !hasOnlyKeys(value, PLUGIN_PACK_KEYS) ||
    typeof value.id !== "string" ||
    !PLUGIN_ID_PATTERN.test(value.id) ||
    !Array.isArray(value.hosts) ||
    value.hosts.length === 0 ||
    !value.hosts.every(
      (host) =>
        typeof host === "string" &&
        PLUGIN_HOSTS.has(host as ExternalPluginHost),
    ) ||
    new Set(value.hosts).size !== value.hosts.length ||
    !Array.isArray(value.plugins) ||
    value.plugins.length === 0 ||
    !value.plugins.every((item) => typeof item === "string" && item.length > 0)
  ) {
    throw invalidManifest("plugin pack", source);
  }
  return value as unknown as ExternalPluginPackManifest;
}

function validatePluginPacks(
  manifests: readonly ExternalPluginPackManifest[],
  host: ExternalPluginHost,
): void {
  const ids = new Set<string>();
  for (const manifest of manifests) {
    if (ids.has(manifest.id)) {
      throw new Error(`Duplicate external plugin pack id: ${manifest.id}`);
    }
    if (!manifest.hosts.includes(host)) {
      throw new Error(
        `External plugin pack ${manifest.id} does not support host ${host}`,
      );
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
    !hasOnlyKeys(value, PLUGIN_MANIFEST_KEYS) ||
    typeof value.apiVersion !== "number" ||
    typeof value.entry !== "string" ||
    value.entry.length === 0 ||
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
): void {
  const ids = new Set<string>();
  for (let index = 0; index < manifests.length; index++) {
    const manifest = manifests[index];
    if (manifest.apiVersion !== SOLITUDE_PLUGIN_API_VERSION) {
      throw new Error(
        `Unsupported plugin API for ${manifest.id} at ${manifestUrls[index]}: ${manifest.apiVersion}`,
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
  if (!hasOnlyKeys(plugin, EXTERNAL_PLUGIN_KEYS)) {
    throw new Error(`External plugin ${expectedId} has invalid properties`);
  }
  if (
    plugin.capabilities !== undefined &&
    !Array.isArray(plugin.capabilities)
  ) {
    throw new Error(`External plugin ${expectedId} has invalid capabilities`);
  }
  if (plugin.hooks !== undefined && !isRecord(plugin.hooks)) {
    throw new Error(`External plugin ${expectedId} has invalid hooks`);
  }
  const hooks = plugin.hooks;
  if (hooks !== undefined && !hasOnlyKeys(hooks, EXTERNAL_PLUGIN_HOOK_KEYS)) {
    throw new Error(`External plugin ${expectedId} has invalid hooks`);
  }
  validateExternalPluginRequirements(plugin.requirements, expectedId);
  if (hasInvalidHookFunctions(hooks?.labels, ["appendLabels"])) {
    throw new Error(`External plugin ${expectedId} has invalid labels`);
  }
  if (
    hasInvalidHookFunctions(hooks?.loop, [
      "afterFrame",
      "initLoop",
      "updateLoopState",
    ])
  ) {
    throw new Error(`External plugin ${expectedId} has invalid loop`);
  }
  if (hasInvalidHookFunctions(hooks?.markers, ["appendMarkers"])) {
    throw new Error(`External plugin ${expectedId} has invalid markers`);
  }
  if (hasInvalidHookFunctions(hooks?.segments, ["appendSegments"])) {
    throw new Error(`External plugin ${expectedId} has invalid segments`);
  }
  if (hasInvalidHookFunctions(hooks?.scene, ["initScene", "updateScene"])) {
    throw new Error(`External plugin ${expectedId} has invalid scene`);
  }
  if (hasInvalidHookFunctions(hooks?.viewControls, ["updateViewControls"])) {
    throw new Error(`External plugin ${expectedId} has invalid view controls`);
  }
  if (hasInvalidHookFunctions(hooks?.views, ["registerViews"])) {
    throw new Error(`External plugin ${expectedId} has invalid views`);
  }
}

function validateExternalPluginRequirements(
  value: unknown,
  expectedId: string,
): void {
  if (value === undefined) return;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, EXTERNAL_PLUGIN_REQUIREMENT_KEYS)
  ) {
    throw new Error(`External plugin ${expectedId} has invalid requirements`);
  }
  const focusEntity = value.focusEntity;
  if (
    focusEntity !== undefined &&
    (!Array.isArray(focusEntity) ||
      focusEntity.some(
        (requirement) =>
          typeof requirement !== "string" ||
          !EXTERNAL_FOCUS_ENTITY_REQUIREMENTS.has(requirement),
      ))
  ) {
    throw new Error(
      `External plugin ${expectedId} has invalid focus entity requirements`,
    );
  }
}

function hasInvalidHookFunctions(
  value: unknown,
  functionNames: readonly string[],
): boolean {
  if (value === undefined) return false;
  if (!isRecord(value)) return true;
  for (const functionName of functionNames) {
    const candidate = value[functionName];
    if (candidate !== undefined && typeof candidate !== "function") return true;
  }
  return false;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) return false;
  }
  return true;
}

function adaptExternalPlugin(plugin: ExternalPlugin): GamePlugin {
  const hooks = plugin.hooks;
  const focusEntityRequirements = plugin.requirements?.focusEntity;
  return {
    id: plugin.id,
    capabilities: plugin.capabilities,
    labels: hooks?.labels as SceneLabelPlugin | undefined,
    loop: adaptExternalLoop(hooks?.loop),
    markers: hooks?.markers as MarkerPlugin | undefined,
    requirements:
      focusEntityRequirements === undefined
        ? undefined
        : { mainFocus: focusEntityRequirements },
    scene: hooks?.scene as ScenePlugin | undefined,
    segments: hooks?.segments as SegmentPlugin | undefined,
    viewControls: hooks?.viewControls as ViewControlPlugin | undefined,
    views: hooks?.views as ViewPlugin | undefined,
  };
}

function adaptExternalLoop(
  external: ExternalLoopPlugin | undefined,
): LoopPlugin | undefined {
  if (external === undefined) return undefined;
  const { afterFrame, initLoop, updateLoopState } = external;

  let currentParams: LoopUpdateParams | undefined;
  let adaptedParams: ExternalLoopUpdateParams | undefined;
  const getAdaptedParams = (
    params: LoopUpdateParams,
  ): ExternalLoopUpdateParams => {
    currentParams = params;
    if (adaptedParams === undefined) {
      adaptedParams = {
        controlInput: params.controlInput,
        dtMillis: params.dtMillis,
        focusEntity: (id) => {
          const current = currentParams;
          if (current?.world === undefined) {
            throw new Error(
              `Cannot focus entity without a runtime world: ${id}`,
            );
          }
          updateFocusContext(current.world, current.mainFocus, id);
        },
        mainFocus: params.mainFocus,
        nowMs: params.nowMs,
        simTimeMillis: params.simTimeMillis,
        state: params.state,
        world: params.world,
      };
    } else {
      adaptedParams.controlInput = params.controlInput;
      adaptedParams.dtMillis = params.dtMillis;
      adaptedParams.mainFocus = params.mainFocus;
      adaptedParams.nowMs = params.nowMs;
      adaptedParams.simTimeMillis = params.simTimeMillis;
      adaptedParams.state = params.state;
      adaptedParams.world = params.world;
    }
    return adaptedParams;
  };

  return {
    afterFrame:
      afterFrame === undefined
        ? undefined
        : (params) => afterFrame(getAdaptedParams(params)),
    initLoop: initLoop === undefined ? undefined : () => initLoop(),
    updateLoopState:
      updateLoopState === undefined
        ? undefined
        : (params) =>
            updateLoopState(
              getAdaptedParams(params),
            ) as LoopUpdateResult | null,
  };
}

async function fetchJsonFromNetwork(url: string): Promise<unknown> {
  const response = await fetch(url, { redirect: "error" });
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
