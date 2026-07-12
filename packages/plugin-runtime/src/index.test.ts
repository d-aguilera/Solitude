import type { ExternalPluginModule } from "@solitude/plugin-api";
import { describe, expect, it, vi } from "vitest";
import { appendExternalPluginSet, loadExternalPluginSet } from "./index";

const setUrl = "https://plugins.example/plugin-set.json";
const manifestUrl = "https://plugins.example/laser/plugin.json";
const entryUrl = "https://plugins.example/laser/index.js";

describe("external plugin runtime", () => {
  it("discovers manifests, imports modules, and preserves declared order", async () => {
    const createLaser = vi.fn(() => ({ id: "targetingLaser" }));
    const createSecond = vi.fn(() => ({ id: "secondPlugin" }));
    const documents = new Map<string, unknown>([
      [
        setUrl,
        {
          schemaVersion: 1,
          plugins: ["./laser/plugin.json", "./second.json"],
        },
      ],
      [
        manifestUrl,
        {
          apiVersion: 1,
          entry: "./index.js",
          environment: "browser",
          id: "targetingLaser",
          schemaVersion: 1,
        },
      ],
      [
        "https://plugins.example/second.json",
        {
          apiVersion: 1,
          entry: "./second.js",
          environment: "browser",
          id: "secondPlugin",
          schemaVersion: 1,
        },
      ],
    ]);
    const modules = new Map<string, ExternalPluginModule>([
      [entryUrl, { createPlugin: createLaser }],
      ["https://plugins.example/second.js", { createPlugin: createSecond }],
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

    await expect(
      loadExternalPluginSet({
        environment: "browser",
        fetchJson: async (url) =>
          url === setUrl
            ? { schemaVersion: 1, plugins: ["./laser/plugin.json"] }
            : {
                apiVersion: 2,
                entry: "./index.js",
                environment: "browser",
                id: "targetingLaser",
                schemaVersion: 1,
              },
        importModule,
        pluginSetUrl: setUrl,
      }),
    ).rejects.toThrow("Unsupported plugin API");
    expect(importModule).not.toHaveBeenCalled();
  });

  it("rejects duplicate ids and host catalog collisions", async () => {
    await expect(
      loadExternalPluginSet({
        environment: "browser",
        fetchJson: async (url) =>
          url === setUrl
            ? {
                schemaVersion: 1,
                plugins: ["./laser/plugin.json", "./laser/again.json"],
              }
            : {
                apiVersion: 1,
                entry: "./index.js",
                environment: "browser",
                id: "targetingLaser",
                schemaVersion: 1,
              },
        importModule: async () => ({ createPlugin: () => ({}) }),
        pluginSetUrl: setUrl,
      }),
    ).rejects.toThrow("Duplicate external plugin id");

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
    const loaded = await loadExternalPluginSet({
      environment: "browser",
      fetchJson: async (url) =>
        url === setUrl
          ? { schemaVersion: 1, plugins: ["./laser/plugin.json"] }
          : {
              apiVersion: 1,
              entry: "./index.js",
              environment: "browser",
              id: "targetingLaser",
              schemaVersion: 1,
            },
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
