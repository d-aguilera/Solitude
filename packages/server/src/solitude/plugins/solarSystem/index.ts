import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import type { EntityConfig } from "@solitude/engine/world";
import {
  buildDefaultSolarSystemShipConfig,
  buildDefaultSolarSystemShipConfigs,
} from "./ships";
import { buildDefaultSolarSystemConfigs } from "./solarSystem";

export function createSolarSystemPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  return {
    id: "solarSystem",
    worldModel: {
      contributeWorldModel: (registry) => {
        const solarSystem = buildDefaultSolarSystemConfigs();
        const entities = buildSolarSystemBodyEntities(solarSystem);
        if (runtimeOptions.ships !== "dynamic") {
          const ships = buildDefaultSolarSystemShipConfigs(solarSystem.physics);
          entities.push(...buildSolarSystemShipEntities(ships));
          registry.setMainFocusEntityId("ship:blue");
        }
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

export function buildSolarSystemShipEntities({
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

export function buildSolarSystemShipEntity(
  physics: ReturnType<typeof buildDefaultSolarSystemConfigs>["physics"],
  id: string,
  index: number,
): EntityConfig {
  const ship = buildDefaultSolarSystemShipConfig(physics, id, index);
  return buildSolarSystemShipEntities({
    ...buildDefaultSolarSystemShipConfigs(physics, []),
    initialStates: [ship.initialState],
    physics: [ship.physics],
    render: [ship.render],
  })[0];
}
