import {
  controllableEntityProviderCapability,
  type ControllableEntityProvider,
} from "@solitude/engine/controllable-entities";
import { vec3 } from "@solitude/engine/math";
import { loadPlugins, type PluginFactory } from "@solitude/engine/plugin";
import {
  applyWorldModelPlugins,
  createScene,
  createWorld,
} from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";
import { describe, expect, it } from "vitest";
import { createShipsPlugin } from "./index";

describe("ships plugin", () => {
  it("places both default ships relative to Earth and chooses blue as focus", () => {
    const config = buildWorldAndSceneConfig();
    applyWorldModelPlugins(
      config,
      loadPlugins({
        catalog: {
          ...simPluginCatalog,
          polyFighter: createTestPolyFighterPlugin,
          ships: createShipsPlugin,
        },
        ids: ["solarSystem", "polyFighter", "ships"],
      }),
    );

    const worldSetup = createWorld(config);
    const sceneSetup = createScene(worldSetup.world, config);
    const earth = worldSetup.world.entityStates.find(
      (entity) => entity.id === "planet:earth",
    );
    const earthSphere = worldSetup.world.collisionSpheres.find(
      (sphere) => sphere.id === "planet:earth",
    );
    const blueFocusedBody = worldSetup.mainFocus.controlledBody;
    const redShip = worldSetup.world.controllableBodies.find(
      (ship) => ship.id === "ship:red",
    );

    expect(config.mainFocusEntityId).toBe("ship:blue");
    expect(worldSetup.mainFocus.entityId).toBe("ship:blue");
    expect(blueFocusedBody.id).toBe("ship:blue");
    expect(worldSetup.world.controllableBodies.map((body) => body.id)).toEqual([
      "ship:blue",
      "ship:red",
    ]);
    expect(earth).toBeDefined();
    expect(redShip).toBeDefined();
    expect(sceneSetup.scene.objects.some((obj) => obj.id === "ship:blue")).toBe(
      true,
    );
    expect(sceneSetup.scene.objects.some((obj) => obj.id === "ship:red")).toBe(
      true,
    );

    const blueOffset = vec3.subInto(
      vec3.zero(),
      blueFocusedBody.position,
      earth!.position,
    );
    const redOffset = vec3.subInto(
      vec3.zero(),
      redShip!.position,
      earth!.position,
    );

    expect(vec3.length(blueOffset)).toBeGreaterThan(earthSphere!.radius);
    expect(vec3.length(redOffset)).toBeGreaterThan(earthSphere!.radius);
    expect(vec3.dot(blueOffset, redOffset)).toBeLessThan(0);
  });
});

const testPolyFighterProvider: ControllableEntityProvider = {
  createEntity: ({ color, id, placement }) => ({
    id,
    components: {
      controllable: { enabled: true },
      gravityMass: { density: 1_000, volume: 1_000 },
      renderable: {
        color,
        mesh: {
          faces: [[0, 1, 2]],
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
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
  mass: 1_000_000,
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
