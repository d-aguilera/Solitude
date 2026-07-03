import { vec3 } from "@solitude/engine/math";
import type { WorldModelRegistry } from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { EntityConfig } from "@solitude/engine/world";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import { describe, expect, it, vi } from "vitest";
import {
  createSolarSystemPlugin,
  parseSolarSystemRuntimeOptions,
} from "../../plugins/solarSystem";
import { buildWorldAndSceneConfig } from "../../worldAndSceneConfig";
import { createSolarSystemCelestialBodyProvider } from "./celestialBodyProvider";

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
          renderable.meshLod.maxSubdivisions === 5 &&
          renderable.meshShading.kind === "smoothSphere",
      ),
    ).toBe(true);
  });

  it("leaves visual texture materials to presentation plugins", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);

    const earth = getEntity(config.entities, "planet:earth");
    const moon = getEntity(config.entities, "planet:moon");
    expect(earth.components.renderable?.material).toBeUndefined();
    expect(moon.components.renderable?.material).toBeUndefined();
  });

  it("scales celestial body densities by the square of the orbital speed multiplier", () => {
    const normalConfig = buildWorldAndSceneConfig();
    const acceleratedConfig = buildWorldAndSceneConfig();

    applyWorldModelPlugins(normalConfig, [createSolarSystemPlugin()]);
    applyWorldModelPlugins(acceleratedConfig, [
      createSolarSystemPlugin({ orbitalSpeedMultiplier: "8" }),
    ]);

    const normalEarth = getEntity(normalConfig.entities, "planet:earth");
    const acceleratedEarth = getEntity(
      acceleratedConfig.entities,
      "planet:earth",
    );

    expect(acceleratedEarth.components.gravityMass?.density).toBe(
      normalEarth.components.gravityMass!.density * 64,
    );
    expect(acceleratedEarth.components.gravityMass?.physicalRadius).toBe(
      normalEarth.components.gravityMass?.physicalRadius,
    );
  });

  it("scales celestial body provider mass and orbital velocity coherently", () => {
    const normalProvider = createSolarSystemCelestialBodyProvider({
      orbitalSpeedMultiplier: 1,
    });
    const acceleratedProvider = createSolarSystemCelestialBodyProvider({
      orbitalSpeedMultiplier: 8,
    });
    const normalEarth = normalProvider.getCelestialBody("planet:earth");
    const acceleratedEarth =
      acceleratedProvider.getCelestialBody("planet:earth");

    expect(normalEarth).toBeTruthy();
    expect(acceleratedEarth).toBeTruthy();
    expect(acceleratedEarth!.mass).toBeCloseTo(normalEarth!.mass * 64, 0);
    expect(vec3.length(acceleratedEarth!.velocity)).toBeCloseTo(
      vec3.length(normalEarth!.velocity) * 8,
      5,
    );
  });

  it("parses orbital speed multiplier runtime options", () => {
    expect(parseSolarSystemRuntimeOptions({})).toEqual({
      orbitalSpeedMultiplier: 1,
    });
    expect(
      parseSolarSystemRuntimeOptions({ orbitalSpeedMultiplier: "16" }),
    ).toEqual({ orbitalSpeedMultiplier: 16 });
    expect(() =>
      parseSolarSystemRuntimeOptions({ orbitalSpeedMultiplier: "0" }),
    ).toThrow("orbitalSpeedMultiplier must be a positive finite number");
  });
});

function getEntity(
  entities: readonly EntityConfig[],
  id: string,
): EntityConfig {
  const entity = entities.find((item) => item.id === id);
  if (!entity) throw new Error(`Missing entity: ${id}`);
  return entity;
}
