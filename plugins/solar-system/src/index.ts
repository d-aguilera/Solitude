import { createCelestialBodyProviderCapability } from "@solitude/plugin-api/celestial-bodies";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import type { ExternalEntityConfig } from "@solitude/plugin-api/world-model";
import { createSolarSystemCelestialBodyProvider } from "./celestialBodyProvider";
import { createSolarSystemEntityNameProvider } from "./localization";
import {
  buildDefaultSolarSystemConfigs,
  type SolarSystemConfigOptions,
} from "./solarSystem";

export const orbitalSpeedMultiplierRuntimeOption = "orbitalSpeedMultiplier";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions = {},
): ExternalPlugin {
  const options = parseSolarSystemRuntimeOptions(runtimeOptions);
  return {
    capabilities: [
      createCelestialBodyProviderCapability(
        createSolarSystemCelestialBodyProvider(options),
      ),
      createSolarSystemEntityNameProvider(runtimeOptions),
    ],
    id: "solarSystem",
    hooks: {
      worldModel: {
        contributeWorldModel: (registry) => {
          const solarSystem = buildDefaultSolarSystemConfigs(options);
          const entities = buildSolarSystemBodyEntities(solarSystem);
          registry.addEntities(entities);
        },
      },
    },
  };
}

export function parseSolarSystemRuntimeOptions(
  runtimeOptions: ExternalRuntimeOptions,
): SolarSystemConfigOptions {
  const raw = runtimeOptions[orbitalSpeedMultiplierRuntimeOption];
  if (raw === undefined) {
    return { orbitalSpeedMultiplier: 1 };
  }

  const orbitalSpeedMultiplier = Number(raw);
  if (!Number.isFinite(orbitalSpeedMultiplier) || orbitalSpeedMultiplier <= 0) {
    throw new Error(
      `${orbitalSpeedMultiplierRuntimeOption} must be a positive finite number`,
    );
  }
  return { orbitalSpeedMultiplier };
}

export function buildSolarSystemBodyEntities({
  physics,
  render,
}: ReturnType<typeof buildDefaultSolarSystemConfigs>): ExternalEntityConfig[] {
  const entities: ExternalEntityConfig[] = [];
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
              meshShading: renderConfig.meshShading,
              meshScale: renderConfig.meshScale,
              material: renderConfig.material,
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
