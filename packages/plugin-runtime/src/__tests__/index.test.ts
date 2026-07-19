import type { LoopUpdateParams } from "@solitude/engine/plugin";
import type { ExternalLoopPlugin } from "@solitude/plugin-api/loop";
import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import type { ExternalPluginModule } from "@solitude/plugin-api/module";
import { describe, expect, it, vi } from "vitest";
import { appendExternalPluginSet, loadExternalPlugins } from "../index";

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
    const updateLoopState: NonNullable<ExternalLoopPlugin["updateLoopState"]> =
      vi.fn((params) => {
        params.focusEntity("ship:second");
        return { framePolicy: { advanceScene: true } };
      });
    const createLaser = vi.fn(() => ({
      id: "targetingLaser",
      hooks: {
        labels: { appendLabels },
        loop: { updateLoopState },
        scene: { initScene, updateScene },
        viewControls: { updateViewControls },
        views: { registerViews },
      },
      requirements: { focusEntity: ["collisionSphere"] as const },
    }));
    const createSecond = vi.fn(() => ({ id: "secondPlugin" }));
    const documents = createDocumentMap();
    const modules = new Map<string, ExternalPluginModule>([
      [laserEntryUrl, { createPlugin: createLaser }],
      [secondEntryUrl, { createPlugin: createSecond }],
    ]);

    const loaded = await loadExternalPlugins({
      configUrl,
      fetchJson: async (url) => documents.get(url),
      host: "browser",
      importModule: async (url) => modules.get(url),
      pageOrigin,
    });

    expect(loaded.ids).toEqual(["targetingLaser", "secondPlugin"]);
    const targetingLaser = loaded.catalog.targetingLaser({});
    expect(targetingLaser.id).toBe("targetingLaser");
    expect(targetingLaser.labels?.appendLabels).toBe(appendLabels);
    const firstBody = {
      id: "ship:first",
    } as LoopUpdateParams["mainFocus"]["controlledBody"];
    const secondBody = {
      id: "ship:second",
    } as LoopUpdateParams["mainFocus"]["controlledBody"];
    const mainFocus: LoopUpdateParams["mainFocus"] = {
      controlledBody: firstBody,
      entityId: firstBody.id,
    };
    expect(
      targetingLaser.loop?.updateLoopState?.({
        controlInput: {},
        dtMillis: 16,
        mainFocus,
        nowMs: 16,
        state: {
          framePolicy: {
            advancePresentation: true,
            advanceScene: true,
            advanceSim: true,
          },
        },
        world: {
          controllableBodies: [firstBody, secondBody],
        } as NonNullable<LoopUpdateParams["world"]>,
      }),
    ).toEqual({ framePolicy: { advanceScene: true } });
    expect(mainFocus).toEqual({
      controlledBody: secondBody,
      entityId: secondBody.id,
    });
    expect(targetingLaser.scene?.initScene).toBe(initScene);
    expect(targetingLaser.scene?.updateScene).toBe(updateScene);
    expect(targetingLaser.viewControls?.updateViewControls).toBe(
      updateViewControls,
    );
    expect(targetingLaser.views?.registerViews).toBe(registerViews);
    expect(targetingLaser.requirements?.mainFocus).toEqual(["collisionSphere"]);
    expect(loaded.catalog.secondPlugin({}).id).toBe("secondPlugin");
  });

  it("rejects a pack that does not support the current host", async () => {
    const documents = createDocumentMap();
    documents.set(
      targetingPackUrl,
      createPackManifest("targeting", ["server"]),
    );
    const fetchJson = vi.fn(async (url: string) => documents.get(url));

    await expect(
      loadExternalPlugins({
        configUrl,
        fetchJson,
        host: "browser",
        importModule: vi.fn(),
        pageOrigin,
      }),
    ).rejects.toThrow("targeting does not support host browser");
    expect(fetchJson).not.toHaveBeenCalledWith(laserManifestUrl);
  });

  it("rejects the removed universal host sentinel", async () => {
    const documents = createDocumentMap();
    documents.set(
      targetingPackUrl,
      createPackManifest("targeting", ["browser", "universal"]),
    );

    await expect(
      loadExternalPlugins({
        configUrl,
        fetchJson: async (url) => documents.get(url),
        host: "browser",
        importModule: vi.fn(),
        pageOrigin,
      }),
    ).rejects.toThrow("Invalid plugin pack manifest");
  });

  it("rejects legacy plugin environment metadata", async () => {
    const documents = createDocumentMap();
    documents.set(laserManifestUrl, {
      ...createPluginManifest("targetingLaser"),
      environment: "browser",
    });

    await expect(
      loadExternalPlugins({
        configUrl,
        fetchJson: async (url) => documents.get(url),
        host: "browser",
        importModule: vi.fn(),
        pageOrigin,
      }),
    ).rejects.toThrow("Invalid plugin manifest");
  });

  it("requires the loader configuration to be same-origin", async () => {
    const fetchJson = vi.fn();

    await expect(
      loadExternalPlugins({
        configUrl: `${pluginOrigin}/loader.json`,
        fetchJson,
        host: "browser",
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
        fetchJson,
        host: "browser",
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
        fetchJson: async (url) => documents.get(url),
        host: "browser",
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
        fetchJson: async (url) => documents.get(url),
        host: "browser",
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
        fetchJson: async (url) => documents.get(url),
        host: "browser",
        importModule,
        pageOrigin,
      }),
    ).rejects.toThrow("Unsupported plugin API");
    expect(importModule).not.toHaveBeenCalled();
  });

  it("rejects duplicate pack and plugin ids", async () => {
    const duplicatePackDocuments = createDocumentMap();
    duplicatePackDocuments.set(
      utilityPackUrl,
      createPackManifest("targeting", ["browser"], ["./second.json"]),
    );

    await expect(
      loadExternalPlugins({
        configUrl,
        fetchJson: async (url) => duplicatePackDocuments.get(url),
        host: "browser",
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
        fetchJson: async (url) => duplicatePluginDocuments.get(url),
        host: "browser",
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

  it("validates factories and their external plugin surface", async () => {
    const documents = createDocumentMap();
    documents.set(setUrl, {
      packs: [targetingPackUrl],
      schemaVersion: 1,
    });

    const wrongId = await loadExternalPlugins({
      configUrl,
      fetchJson: async (url) => documents.get(url),
      host: "browser",
      importModule: async () => ({
        createPlugin: () => ({ id: "wrongPlugin" }),
      }),
      pageOrigin,
    });
    expect(() => wrongId.catalog.targetingLaser({})).toThrow(
      "returned id wrongPlugin",
    );

    const invalidHooks = await loadExternalPlugins({
      configUrl,
      fetchJson: async (url) => documents.get(url),
      host: "browser",
      importModule: async () => ({
        createPlugin: () => ({
          id: "targetingLaser",
          hooks: { viewControls: { updateViewControls: "invalid" } },
        }),
      }),
      pageOrigin,
    });
    expect(() => invalidHooks.catalog.targetingLaser({})).toThrow(
      "invalid view controls",
    );

    const invalidLoop = await loadExternalPlugins({
      configUrl,
      fetchJson: async (url) => documents.get(url),
      host: "browser",
      importModule: async () => ({
        createPlugin: () => ({
          id: "targetingLaser",
          hooks: { loop: { updateLoopState: "invalid" } },
        }),
      }),
      pageOrigin,
    });
    expect(() => invalidLoop.catalog.targetingLaser({})).toThrow(
      "invalid loop",
    );

    const legacyHooks = await loadExternalPlugins({
      configUrl,
      fetchJson: async (url) => documents.get(url),
      host: "browser",
      importModule: async () => ({
        createPlugin: () => ({
          id: "targetingLaser",
          views: { registerViews: vi.fn() },
        }),
      }),
      pageOrigin,
    });
    expect(() => legacyHooks.catalog.targetingLaser({})).toThrow(
      "invalid properties",
    );

    const invalidRequirements = await loadExternalPlugins({
      configUrl,
      fetchJson: async (url) => documents.get(url),
      host: "browser",
      importModule: async () => ({
        createPlugin: () => ({
          id: "targetingLaser",
          requirements: { focusEntity: ["controlledBody"] },
        }),
      }),
      pageOrigin,
    });
    expect(() => invalidRequirements.catalog.targetingLaser({})).toThrow(
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
      createPackManifest("targeting", ["browser"], ["./laser/plugin.json"]),
    ],
    [
      utilityPackUrl,
      createPackManifest("utility", ["browser"], ["./second.json"]),
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

function createPackManifest(
  id: string,
  hosts: readonly string[],
  plugins: readonly string[] = ["./laser/plugin.json"],
) {
  return { hosts, id, plugins, schemaVersion: 2 };
}

function createPluginManifest(
  id: string,
  apiVersion = SOLITUDE_PLUGIN_API_VERSION,
  entry = "./index.js",
) {
  return { apiVersion, entry, id, schemaVersion: 2 };
}
