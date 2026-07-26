import { vec3 } from "@solitude/plugin-api/math";
import type { ExternalEntityConfig } from "@solitude/plugin-api/world-model";
import { describe, expect, it, vi } from "vitest";
import { createSolarSystemCelestialBodyProvider } from "../celestialBodyProvider";
import { createPlugin, parseSolarSystemRuntimeOptions } from "../index";

describe("solarSystem plugin", () => {
  it("contributes world content through generic entities", () => {
    const addEntities = vi.fn();
    const setMainFocusEntityId = vi.fn();

    createPlugin().hooks?.worldModel?.contributeWorldModel(
      { addEntities, setMainFocusEntityId },
      { capabilityRegistry: { getAll: () => [] } },
    );

    expect(addEntities).toHaveBeenCalledOnce();
    expect(setMainFocusEntityId).not.toHaveBeenCalled();
    expect(
      (addEntities.mock.calls[0][0] as ExternalEntityConfig[]).map(
        (entity) => entity.id,
      ),
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

  it("shares one unit sphere mesh across solar bodies and scales per entity", () => {
    const entities = contributeEntities();
    const renderables = entities.map((entity) => {
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
    const entities = contributeEntities();
    const earth = getEntity(entities, "planet:earth");
    const moon = getEntity(entities, "planet:moon");

    expect(earth.components.renderable?.material).toBeUndefined();
    expect(moon.components.renderable?.material).toBeUndefined();
  });

  it("scales celestial body densities by the square of the orbital speed multiplier", () => {
    const normalEarth = getEntity(contributeEntities(), "planet:earth");
    const acceleratedEarth = getEntity(
      contributeEntities({ orbitalSpeedMultiplier: "8" }),
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

function contributeEntities(
  runtimeOptions: Record<string, string> = {},
): ExternalEntityConfig[] {
  let entities: ExternalEntityConfig[] = [];
  createPlugin(runtimeOptions).hooks?.worldModel?.contributeWorldModel(
    {
      addEntities: (contribution) => {
        entities = contribution;
      },
      setMainFocusEntityId: vi.fn(),
    },
    { capabilityRegistry: { getAll: () => [] } },
  );
  return entities;
}

function getEntity(
  entities: readonly ExternalEntityConfig[],
  id: string,
): ExternalEntityConfig {
  const entity = entities.find((item) => item.id === id);
  if (!entity) throw new Error(`Missing entity: ${id}`);
  return entity;
}
