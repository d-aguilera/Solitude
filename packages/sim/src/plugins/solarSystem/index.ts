import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import type { EntityConfig } from "@solitude/engine/world";
import { celestialBodyProviderCapability } from "../../celestialBodies/provider";
import { createSolarSystemCelestialBodyProvider } from "./celestialBodyProvider";
import { createSolarSystemEntityNameProvider } from "./localization";
import { buildDefaultSolarSystemConfigs } from "./solarSystem";

export function createSolarSystemPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  return {
    capabilities: [
      {
        id: celestialBodyProviderCapability,
        value: createSolarSystemCelestialBodyProvider(),
      },
      createSolarSystemEntityNameProvider(runtimeOptions),
    ],
    id: "solarSystem",
    worldModel: {
      contributeWorldModel: (registry) => {
        const solarSystem = buildDefaultSolarSystemConfigs();
        const entities = buildSolarSystemBodyEntities(solarSystem);
        registry.addEntities(entities);
      },
    },
  };
}

export function buildSolarSystemBodyEntities({
  physics,
  render,
}: ReturnType<typeof buildDefaultSolarSystemConfigs>): EntityConfig[] {
  const entities: EntityConfig[] = [];
  for (const body of physics) {
    const renderConfig = render.find((item) => item.id === body.id);
    entities.push({
      id: body.id,
      components: {
        axialSpin: {
          angularSpeedRadPerSec: body.angularSpeedRadPerSec,
          obliquityRad: body.obliquityRad,
        },
        collisionSphere: {
          radius: body.physicalRadius,
        },
        gravityMass: {
          density: body.density,
          physicalRadius: body.physicalRadius,
        },
        lightEmitter:
          body.luminosity !== undefined
            ? {
                luminosity: body.luminosity,
              }
            : undefined,
        renderable: renderConfig
          ? {
              color: renderConfig.color,
              mesh: renderConfig.mesh,
              meshLod: renderConfig.meshLod,
              meshScale: renderConfig.meshScale,
              role:
                body.luminosity !== undefined ? "lightEmitter" : "orbitalBody",
            }
          : undefined,
        state: {
          centralEntityId: body.centralEntityId,
          kind: "keplerian",
          orbit: body.orbit,
        },
      },
    });
  }
  return entities;
}
