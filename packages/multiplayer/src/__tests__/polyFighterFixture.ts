import {
  controllableEntityProviderCapability,
  type ControllableEntityProvider,
} from "@solitude/engine/controllable-entities";
import type { PluginFactory } from "@solitude/engine/plugin";
import type { DefaultMultiplayerContentPluginFactories } from "../composition";

const TEST_FIGHTER_DENSITY = 1_000;
const TEST_FIGHTER_VOLUME = 1_000;

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

export const testMultiplayerContentPlugins: DefaultMultiplayerContentPluginFactories =
  {
    polyFighter: createTestPolyFighterPlugin,
  };
