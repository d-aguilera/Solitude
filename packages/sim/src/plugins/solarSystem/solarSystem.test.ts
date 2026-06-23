import type { WorldModelRegistry } from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { EntityConfig } from "@solitude/engine/world";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import { describe, expect, it, vi } from "vitest";
import { createSolarSystemPlugin } from "../../plugins/solarSystem";
import { buildWorldAndSceneConfig } from "../../worldAndSceneConfig";

describe("solarSystem plugin", () => {
  it("contributes world content through generic entities", () => {
    const config = buildWorldAndSceneConfig();
    const addEntities = vi.fn<WorldModelRegistry["addEntities"]>();
    const registry: WorldModelRegistry = {
      addEntities,
      setMainFocusEntityId: vi.fn(),
    };

    createSolarSystemPlugin().worldModel!.contributeWorldModel(registry, {
      capabilityRegistry: createPluginCapabilityRegistry(),
      config,
    });

    expect(registry.addEntities).toHaveBeenCalledOnce();
    expect(registry.setMainFocusEntityId).not.toHaveBeenCalled();
    expect(
      addEntities.mock.calls[0][0].map((entity: EntityConfig) => entity.id),
    ).toEqual([
      "planet:sun",
      "planet:mercury",
      "planet:venus",
      "planet:earth",
      "planet:mars",
      "planet:jupiter",
      "planet:saturn",
      "planet:uranus",
      "planet:neptune",
      "planet:moon",
      "planet:phobos",
      "planet:deimos",
    ]);
  });

  it("contributes solar bodies without choosing a main focus", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);
    expect(config.mainFocusEntityId).toBe("");
    expect(config.entities.map((entity) => entity.id)).toEqual([
      "planet:sun",
      "planet:mercury",
      "planet:venus",
      "planet:earth",
      "planet:mars",
      "planet:jupiter",
      "planet:saturn",
      "planet:uranus",
      "planet:neptune",
      "planet:moon",
      "planet:phobos",
      "planet:deimos",
    ]);
    expect(config.entities[0].components.lightEmitter?.luminosity).toBeTruthy();
    expect(
      config.entities.some((entity) => entity.components.controllable),
    ).toBe(false);
  });

  it("shares one unit sphere mesh across solar bodies and scales per entity", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);

    const renderables = config.entities.map((entity) => {
      const renderable = entity.components.renderable;
      if (!renderable) throw new Error(`Missing renderable: ${entity.id}`);
      return renderable;
    });
    const firstMesh = renderables[0].mesh;
    expect(
      renderables.every((renderable) => renderable.mesh === firstMesh),
    ).toBe(true);
    expect(
      new Set(renderables.map((renderable) => renderable.meshScale)).size,
    ).toBeGreaterThan(1);
    expect(
      renderables.every(
        (renderable) =>
          renderable.meshLod.kind === "unitIcosphere" &&
          renderable.meshLod.maxSubdivisions === 4 &&
          renderable.meshShading.kind === "smoothSphere",
      ),
    ).toBe(true);
  });
});
