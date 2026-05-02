import type { EntityConfig } from "../../app/entityConfigPorts";
import type { GamePlugin } from "../../app/pluginPorts";
import { buildDefaultSolarSystemShipConfigs } from "./ships";
import { buildDefaultSolarSystemConfigs } from "./solarSystem";

export function createSolarSystemPlugin(): GamePlugin {
  return {
    id: "solarSystem",
    worldModel: {
      contributeWorldModel: (registry) => {
        const solarSystem = buildDefaultSolarSystemConfigs();
        const ships = buildDefaultSolarSystemShipConfigs(solarSystem.physics);
        registry.addEntities([
          ...buildSolarSystemBodyEntities(solarSystem),
          ...buildSolarSystemShipEntities(ships),
        ]);
        registry.setMainFocusEntityId("ship:main");
      },
    },
  };
}

function buildSolarSystemBodyEntities({
  physics,
  render,
}: ReturnType<typeof buildDefaultSolarSystemConfigs>): EntityConfig[] {
  const entities: EntityConfig[] = [];
  for (const body of physics) {
    const renderConfig = render.find((item) => item.id === body.id);
    entities.push({
      id: body.id,
      metadata: {
        legacyKind: body.kind,
      },
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
          body.kind === "star"
            ? {
                luminosity: body.luminosity,
              }
            : undefined,
        renderable: renderConfig
          ? {
              color: renderConfig.color,
              mesh: renderConfig.mesh,
              role: body.kind === "star" ? "lightEmitter" : "celestialBody",
            }
          : undefined,
        state: {
          centralBodyId: body.centralBodyId,
          kind: "keplerian",
          orbit: body.orbit,
        },
      },
    });
  }
  return entities;
}

function buildSolarSystemShipEntities({
  initialStates,
  physics,
  render,
}: ReturnType<typeof buildDefaultSolarSystemShipConfigs>): EntityConfig[] {
  const entities: EntityConfig[] = [];
  for (const ship of physics) {
    const initialState = initialStates.find((item) => item.id === ship.id);
    const renderConfig = render.find((item) => item.id === ship.id);
    entities.push({
      id: ship.id,
      metadata: {
        legacyKind: "ship",
      },
      components: {
        controllable: {
          enabled: true,
        },
        gravityMass: {
          density: ship.density,
          volume: ship.volume,
        },
        renderable: renderConfig
          ? {
              color: renderConfig.color,
              mesh: renderConfig.mesh,
              role: "controlledBody",
            }
          : undefined,
        state: initialState
          ? {
              angularVelocity: initialState.angularVelocity,
              frame: initialState.frame,
              kind: "direct",
              orientation: initialState.orientation,
              position: initialState.position,
              velocity: initialState.velocity,
            }
          : undefined,
      },
    });
  }
  return entities;
}
