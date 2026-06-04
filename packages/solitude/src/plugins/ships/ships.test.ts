import { vec3 } from "@solitude/engine/math";
import {
  applyWorldModelPlugins,
  createScene,
  createWorld,
} from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { describe, expect, it } from "vitest";
import { createShipsPlugin } from "./index";

describe("ships plugin", () => {
  it("places both default ships relative to Earth and chooses blue as focus", () => {
    const config = buildWorldAndSceneConfig();
    applyWorldModelPlugins(config, [
      createSolarSystemPlugin(),
      createShipsPlugin(),
    ]);

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
