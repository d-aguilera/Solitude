import { celestialBodyProviderCapability } from "@solitude/engine/celestial-bodies";
import {
  controllableEntityProviderCapability,
  type ControllableEntityProvider,
} from "@solitude/engine/controllable-entities";
import { vec3 } from "@solitude/engine/math";
import type { PluginFactory } from "@solitude/engine/plugin";
import type { DefaultMultiplayerContentPluginSet } from "../composition";

const TEST_FIGHTER_DENSITY = 1_000;
const TEST_FIGHTER_VOLUME = 1_000;
const TEST_EARTH_DENSITY = 5_514;
const TEST_EARTH_MASS = 5.972e24;
const TEST_EARTH_RADIUS = 6_371_000;

const testPolyFighterProvider: ControllableEntityProvider = {
  createEntity: ({ color, id, placement }) => ({
    id,
    components: {
      controllable: { enabled: true },
      gravityMass: {
        density: TEST_FIGHTER_DENSITY,
        volume: TEST_FIGHTER_VOLUME,
      },
      renderable: {
        color,
        mesh: {
          faces: [
            [0, 2, 1],
            [0, 1, 3],
            [1, 2, 3],
            [2, 0, 3],
          ],
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: 0, z: 1 },
          ],
        },
        meshLod: { kind: "none" },
        meshScale: 1,
        meshShading: { kind: "flat" },
        role: "controlledBody",
      },
      state: {
        angularVelocity: placement.angularVelocity,
        frame: placement.frame,
        kind: "direct",
        orientation: placement.orientation,
        position: placement.position,
        velocity: placement.velocity,
      },
    },
  }),
  id: "polyFighter",
  mass: TEST_FIGHTER_DENSITY * TEST_FIGHTER_VOLUME,
};

const createTestPolyFighterPlugin: PluginFactory = () => ({
  capabilities: [
    {
      id: controllableEntityProviderCapability,
      value: testPolyFighterProvider,
    },
  ],
  id: "polyFighter",
});

const createTestSolarSystemPlugin: PluginFactory = () => ({
  capabilities: [
    {
      id: celestialBodyProviderCapability,
      value: {
        getCelestialBody: (id: string) =>
          id === "planet:earth"
            ? {
                id,
                mass: TEST_EARTH_MASS,
                physicalRadius: TEST_EARTH_RADIUS,
                position: vec3.zero(),
                velocity: vec3.zero(),
              }
            : null,
      },
    },
  ],
  id: "solarSystem",
  worldModel: {
    contributeWorldModel: (registry) =>
      registry.addEntities([
        {
          id: "planet:earth",
          components: {
            axialSpin: {
              angularSpeedRadPerSec: 0,
              obliquityRad: 0,
            },
            collisionSphere: { radius: TEST_EARTH_RADIUS },
            gravityMass: {
              density: TEST_EARTH_DENSITY,
              mass: TEST_EARTH_MASS,
              physicalRadius: TEST_EARTH_RADIUS,
            },
            state: {
              centralEntityId: "planet:earth",
              kind: "keplerian",
              orbit: {
                argPeriapsisRad: 0,
                eccentricity: 0,
                inclinationRad: 0,
                lonAscNodeRad: 0,
                meanAnomalyAtEpochRad: 0,
                semiMajorAxis: 0,
              },
            },
          },
        },
      ]),
  },
});

const createTestAutopilotPlugin: PluginFactory = () => ({
  id: "autopilot",
});

const createTestSpacecraftOperatorPlugin: PluginFactory = () => ({
  id: "spacecraftOperator",
  simulation: {
    updateVehicleDynamics: ({
      controlInputsByEntityId,
      dtMillis,
      dtMillisSim,
      world,
    }) => {
      for (const body of world.controllableBodies) {
        const input = controlInputsByEntityId.get(body.id);
        if (!input) continue;
        const thrustLevel = findThrustLevel(input);
        if (input.burnForward) {
          addScaledVelocity(
            body.velocity,
            body.frame.forward,
            (1_000_000 * Math.pow(thrustLevel / 9, 3) * dtMillisSim) / 1000,
          );
        }
        if (input.burnRight) {
          addScaledVelocity(
            body.velocity,
            body.frame.right,
            (20_000 * dtMillisSim) / 1000,
          );
        }
        if (input.yawLeft) {
          body.angularVelocity.yaw = Math.min(0.5, (4 * dtMillis) / 1000);
        }
      }
    },
  },
});

function addScaledVelocity(
  velocity: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  scale: number,
): void {
  velocity.x += direction.x * scale;
  velocity.y += direction.y * scale;
  velocity.z += direction.z * scale;
}

function findThrustLevel(input: Readonly<Record<string, boolean>>): number {
  for (let level = 9; level >= 0; level--) {
    if (input[`thrust${level}`]) return level;
  }
  return 1;
}

export const testMultiplayerContentPlugins: DefaultMultiplayerContentPluginSet =
  {
    catalog: {
      autopilot: createTestAutopilotPlugin,
      polyFighter: createTestPolyFighterPlugin,
      solarSystem: createTestSolarSystemPlugin,
      spacecraftOperator: createTestSpacecraftOperatorPlugin,
    },
    ids: ["solarSystem", "autopilot", "spacecraftOperator", "polyFighter"],
  };
