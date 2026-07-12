import type { ExternalPluginModule } from "@solitude/plugin-api";
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
    const createLaser = vi.fn(() => ({ id: "targetingLaser" }));
    const createSecond = vi.fn(() => ({ id: "secondPlugin" }));
    const documents = createDocumentMap();
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
    expect(loaded.catalog.targetingLaser({}).id).toBe("targetingLaser");
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
    documents.set(laserManifestUrl, createPluginManifest("targetingLaser", 2));

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
    [secondManifestUrl, createPluginManifest("secondPlugin", 1, "./second.js")],
  ]);
}

function createPluginManifest(
  id: string,
  apiVersion = 1,
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
