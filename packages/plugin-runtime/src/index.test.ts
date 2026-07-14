import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import type { ExternalPluginModule } from "@solitude/plugin-api/module";
import { describe, expect, it, vi } from "vitest";
import { appendExternalPluginSet, loadExternalPlugins } from "./index";

const pageOrigin = "https://app.example";
const pluginOrigin = "https://plugins.example";
const configUrl = `${pageOrigin}/plugins/loader.json`;
const setUrl = `${pageOrigin}/plugins/plugin-set.json`;
const targetingPackUrl = `${pluginOrigin}/packs/targeting/pack.json`;
const utilityPackUrl = `${pluginOrigin}/packs/utility/pack.json`;
const laserManifestUrl = `${pluginOrigin}/packs/targeting/laser/plugin.json`;
const secondManifestUrl = `${pluginOrigin}/packs/utility/second.json`;
const laserEntryUrl = `${pluginOrigin}/packs/targeting/laser/index.js`;
const secondEntryUrl = `${pluginOrigin}/packs/utility/second.js`;

describe("external plugin runtime", () => {
  it("loads explicitly allowed cross-origin plugin packs in order", async () => {
    const initScene = vi.fn();
    const appendLabels = vi.fn();
    const registerViews = vi.fn();
    const updateScene = vi.fn();
    const updateViewControls = vi.fn();
    const createLaser = vi.fn(() => ({
      id: "targetingLaser",
      hooks: {
        labels: { appendLabels },
        scene: { initScene, updateScene },
        viewControls: { updateViewControls },
        views: { registerViews },
      },
      requirements: { focusEntity: ["collisionSphere"] as const },
    }));
    const createSecond = vi.fn(() => ({ id: "secondPlugin" }));
    const documents = createDocumentMap();
    documents.set(laserManifestUrl, {
      ...createPluginManifest("targetingLaser"),
      environment: "universal",
    });
    const modules = new Map<string, ExternalPluginModule>([
      [laserEntryUrl, { createPlugin: createLaser }],
      [secondEntryUrl, { createPlugin: createSecond }],
    ]);

    const loaded = await loadExternalPlugins({
      configUrl,
      environment: "browser",
      fetchJson: async (url) => documents.get(url),
      importModule: async (url) => modules.get(url),
      pageOrigin,
    });

    expect(loaded.ids).toEqual(["targetingLaser", "secondPlugin"]);
    const targetingLaser = loaded.catalog.targetingLaser({});
    expect(targetingLaser.id).toBe("targetingLaser");
    expect(targetingLaser.labels?.appendLabels).toBe(appendLabels);
    expect(targetingLaser.scene?.initScene).toBe(initScene);
    expect(targetingLaser.scene?.updateScene).toBe(updateScene);
    expect(targetingLaser.viewControls?.updateViewControls).toBe(
      updateViewControls,
    );
    expect(targetingLaser.views?.registerViews).toBe(registerViews);
    expect(targetingLaser.requirements?.mainFocus).toEqual(["collisionSphere"]);
    expect(loaded.catalog.secondPlugin({}).id).toBe("secondPlugin");
  });

  it("requires the loader configuration to be same-origin", async () => {
    const fetchJson = vi.fn();

    await expect(
      loadExternalPlugins({
        configUrl: `${pluginOrigin}/loader.json`,
        environment: "browser",
        fetchJson,
        importModule: vi.fn(),
        pageOrigin,
      }),
    ).rejects.toThrow("loader config must be same-origin");
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("rejects disallowed pack origins before fetching them", async () => {
    const documents = createDocumentMap(["self"]);
    const fetchJson = vi.fn(async (url: string) => documents.get(url));

    await expect(
      loadExternalPlugins({
        configUrl,
        environment: "browser",
        fetchJson,
        importModule: vi.fn(),
        pageOrigin,
      }),
    ).rejects.toThrow(
      `Disallowed plugin pack manifest origin: ${pluginOrigin}`,
    );
    expect(fetchJson).not.toHaveBeenCalledWith(targetingPackUrl);
  });

  it("rejects disallowed module origins before importing them", async () => {
    const documents = createDocumentMap();
    documents.set(secondManifestUrl, {
      ...createPluginManifest("secondPlugin"),
      entry: "https://evil.example/index.js",
    });
    const importModule = vi.fn();

    await expect(
      loadExternalPlugins({
        configUrl,
        environment: "browser",
        fetchJson: async (url) => documents.get(url),
        importModule,
        pageOrigin,
      }),
    ).rejects.toThrow("Disallowed plugin module origin");
    expect(importModule).not.toHaveBeenCalled();
  });

  it("rejects invalid allowed origins", async () => {
    const documents = createDocumentMap(["https://plugins.example/path"]);

    await expect(
      loadExternalPlugins({
        configUrl,
        environment: "browser",
        fetchJson: async (url) => documents.get(url),
        importModule: vi.fn(),
        pageOrigin,
      }),
    ).rejects.toThrow("Invalid allowed plugin origin");
  });

  it("rejects incompatible APIs before importing any module", async () => {
    const importModule = vi.fn();
    const documents = createDocumentMap();
    documents.set(
      laserManifestUrl,
      createPluginManifest("targetingLaser", SOLITUDE_PLUGIN_API_VERSION + 1),
    );

    await expect(
      loadExternalPlugins({
        configUrl,
        environment: "browser",
        fetchJson: async (url) => documents.get(url),
        importModule,
        pageOrigin,
      }),
    ).rejects.toThrow("Unsupported plugin API");
    expect(importModule).not.toHaveBeenCalled();
  });

  it("rejects duplicate pack and plugin ids", async () => {
    const duplicatePackDocuments = createDocumentMap();
    duplicatePackDocuments.set(utilityPackUrl, {
      id: "targeting",
      plugins: ["./second.json"],
      schemaVersion: 1,
    });

    await expect(
      loadExternalPlugins({
        configUrl,
        environment: "browser",
        fetchJson: async (url) => duplicatePackDocuments.get(url),
        importModule: async () => ({ createPlugin: () => ({}) }),
        pageOrigin,
      }),
    ).rejects.toThrow("Duplicate external plugin pack id");

    const duplicatePluginDocuments = createDocumentMap();
    duplicatePluginDocuments.set(
      secondManifestUrl,
      createPluginManifest("targetingLaser"),
    );
    await expect(
      loadExternalPlugins({
        configUrl,
        environment: "browser",
        fetchJson: async (url) => duplicatePluginDocuments.get(url),
        importModule: async () => ({ createPlugin: () => ({}) }),
        pageOrigin,
      }),
    ).rejects.toThrow("Duplicate external plugin id");
  });

  it("rejects collisions with the host catalog", () => {
    expect(() =>
      appendExternalPluginSet(
        { targetingLaser: () => ({ id: "targetingLaser" }) },
        ["targetingLaser"],
        {
          catalog: { targetingLaser: () => ({ id: "targetingLaser" }) },
          ids: ["targetingLaser"],
        },
      ),
    ).toThrow("collides with host plugin");
  });

  it("validates the plugin id returned by a loaded factory", async () => {
    const documents = createDocumentMap();
    documents.set(setUrl, {
      packs: [targetingPackUrl],
      schemaVersion: 1,
    });

    const loaded = await loadExternalPlugins({
      configUrl,
      environment: "browser",
      fetchJson: async (url) => documents.get(url),
      importModule: async () => ({
        createPlugin: () => ({ id: "wrongPlugin" }),
      }),
      pageOrigin,
    });

    expect(() => loaded.catalog.targetingLaser({})).toThrow(
      "returned id wrongPlugin",
    );
  });

  it("rejects invalid view controls returned by a loaded factory", async () => {
    const documents = createDocumentMap();
    documents.set(setUrl, {
      packs: [targetingPackUrl],
      schemaVersion: 1,
    });

    const loaded = await loadExternalPlugins({
      configUrl,
      environment: "browser",
      fetchJson: async (url) => documents.get(url),
      importModule: async () => ({
        createPlugin: () => ({
          id: "targetingLaser",
          hooks: { viewControls: { updateViewControls: "invalid" } },
        }),
      }),
      pageOrigin,
    });

    expect(() => loaded.catalog.targetingLaser({})).toThrow(
      "invalid view controls",
    );
  });

  it("rejects legacy top-level hooks returned by a loaded factory", async () => {
    const documents = createDocumentMap();
    documents.set(setUrl, {
      packs: [targetingPackUrl],
      schemaVersion: 1,
    });

    const loaded = await loadExternalPlugins({
      configUrl,
      environment: "browser",
      fetchJson: async (url) => documents.get(url),
      importModule: async () => ({
        createPlugin: () => ({
          id: "targetingLaser",
          views: { registerViews: vi.fn() },
        }),
      }),
      pageOrigin,
    });

    expect(() => loaded.catalog.targetingLaser({})).toThrow(
      "invalid properties",
    );
  });

  it("rejects focus requirements guaranteed by the focus context", async () => {
    const documents = createDocumentMap();
    documents.set(setUrl, {
      packs: [targetingPackUrl],
      schemaVersion: 1,
    });

    const loaded = await loadExternalPlugins({
      configUrl,
      environment: "browser",
      fetchJson: async (url) => documents.get(url),
      importModule: async () => ({
        createPlugin: () => ({
          id: "targetingLaser",
          requirements: { focusEntity: ["controlledBody"] },
        }),
      }),
      pageOrigin,
    });

    expect(() => loaded.catalog.targetingLaser({})).toThrow(
      "invalid focus entity requirements",
    );
  });
});

function createDocumentMap(
  allowedOrigins: readonly string[] = ["self", pluginOrigin],
): Map<string, unknown> {
  return new Map<string, unknown>([
    [
      configUrl,
      {
        allowedOrigins,
        pluginSet: "./plugin-set.json",
        schemaVersion: 1,
      },
    ],
    [
      setUrl,
      {
        packs: [targetingPackUrl, utilityPackUrl],
        schemaVersion: 1,
      },
    ],
    [
      targetingPackUrl,
      {
        id: "targeting",
        plugins: ["./laser/plugin.json"],
        schemaVersion: 1,
      },
    ],
    [
      utilityPackUrl,
      {
        id: "utility",
        plugins: ["./second.json"],
        schemaVersion: 1,
      },
    ],
    [laserManifestUrl, createPluginManifest("targetingLaser")],
    [
      secondManifestUrl,
      createPluginManifest(
        "secondPlugin",
        SOLITUDE_PLUGIN_API_VERSION,
        "./second.js",
      ),
    ],
  ]);
}

function createPluginManifest(
  id: string,
  apiVersion = SOLITUDE_PLUGIN_API_VERSION,
  entry = "./index.js",
) {
  return {
    apiVersion,
    entry,
    environment: "browser",
    id,
    schemaVersion: 1,
  };
}
