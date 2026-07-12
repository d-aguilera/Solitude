import type { ExternalPluginModule } from "@solitude/plugin-api";
import { describe, expect, it, vi } from "vitest";
import { appendExternalPluginSet, loadExternalPluginSet } from "./index";

const setUrl = "https://plugins.example/plugin-set.json";
const targetingPackUrl = "https://plugins.example/packs/targeting/pack.json";
const utilityPackUrl = "https://plugins.example/packs/utility/pack.json";
const laserManifestUrl =
  "https://plugins.example/packs/targeting/laser/plugin.json";
const secondManifestUrl = "https://plugins.example/packs/utility/second.json";
const laserEntryUrl = "https://plugins.example/packs/targeting/laser/index.js";
const secondEntryUrl = "https://plugins.example/packs/utility/second.js";

describe("external plugin runtime", () => {
  it("expands ordered packs and preserves plugin order", async () => {
    const createLaser = vi.fn(() => ({ id: "targetingLaser" }));
    const createSecond = vi.fn(() => ({ id: "secondPlugin" }));
    const documents = createDocumentMap();
    const modules = new Map<string, ExternalPluginModule>([
      [laserEntryUrl, { createPlugin: createLaser }],
      [secondEntryUrl, { createPlugin: createSecond }],
    ]);

    const loaded = await loadExternalPluginSet({
      environment: "browser",
      fetchJson: async (url) => documents.get(url),
      importModule: async (url) => modules.get(url),
      pluginSetUrl: setUrl,
    });

    expect(loaded.ids).toEqual(["targetingLaser", "secondPlugin"]);
    expect(loaded.catalog.targetingLaser({}).id).toBe("targetingLaser");
    expect(loaded.catalog.secondPlugin({}).id).toBe("secondPlugin");
  });

  it("rejects incompatible APIs before importing any module", async () => {
    const importModule = vi.fn();
    const documents = createDocumentMap();
    documents.set(laserManifestUrl, createPluginManifest("targetingLaser", 2));

    await expect(
      loadExternalPluginSet({
        environment: "browser",
        fetchJson: async (url) => documents.get(url),
        importModule,
        pluginSetUrl: setUrl,
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
      loadExternalPluginSet({
        environment: "browser",
        fetchJson: async (url) => duplicatePackDocuments.get(url),
        importModule: async () => ({ createPlugin: () => ({}) }),
        pluginSetUrl: setUrl,
      }),
    ).rejects.toThrow("Duplicate external plugin pack id");

    const duplicatePluginDocuments = createDocumentMap();
    duplicatePluginDocuments.set(
      secondManifestUrl,
      createPluginManifest("targetingLaser"),
    );
    await expect(
      loadExternalPluginSet({
        environment: "browser",
        fetchJson: async (url) => duplicatePluginDocuments.get(url),
        importModule: async () => ({ createPlugin: () => ({}) }),
        pluginSetUrl: setUrl,
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
      packs: ["./packs/targeting/pack.json"],
      schemaVersion: 1,
    });

    const loaded = await loadExternalPluginSet({
      environment: "browser",
      fetchJson: async (url) => documents.get(url),
      importModule: async () => ({
        createPlugin: () => ({ id: "wrongPlugin" }),
      }),
      pluginSetUrl: setUrl,
    });

    expect(() => loaded.catalog.targetingLaser({})).toThrow(
      "returned id wrongPlugin",
    );
  });
});

function createDocumentMap(): Map<string, unknown> {
  return new Map<string, unknown>([
    [
      setUrl,
      {
        packs: ["./packs/targeting/pack.json", "./packs/utility/pack.json"],
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
