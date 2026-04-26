import { describe, expect, it } from "vitest";
import { applyWorldModelPlugins } from "../../app/worldModelConfig";
import { buildWorldAndSceneConfig } from "../../config/worldAndSceneConfig";
import { vec3 } from "../../domain/vec3";
import { createScene } from "../../setup/sceneSetup";
import { createWorld } from "../../setup/setup";
import { createSolarSystemPlugin } from "./index";

describe("solarSystem plugin", () => {
  it("contributes solar bodies, main ship, and enemy ship", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);

    expect(config.mainShipId).toBe("ship:main");
    expect(config.mainControlledEntityId).toBe("ship:main");
    expect(config.physics.planets.map((body) => body.id)).toEqual([
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
    expect(config.physics.ships.map((ship) => ship.id)).toEqual([
      "ship:main",
      "ship:enemy",
    ]);
    expect(config.render.ships.map((ship) => ship.id)).toEqual([
      "ship:main",
      "ship:enemy",
    ]);
    expect(config.physics.shipInitialStates.map((state) => state.id)).toEqual([
      "ship:main",
      "ship:enemy",
    ]);
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
      "ship:main",
      "ship:enemy",
    ]);
    expect(config.entities[0].components.lightEmitter?.luminosity).toBeTruthy();
    expect(
      config.entities.find((entity) => entity.id === "ship:main")?.components
        .controllable?.enabled,
    ).toBe(true);
  });

  it("places both default ships relative to Earth and renders the scene", () => {
    const config = buildWorldAndSceneConfig();
    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);

    const worldSetup = createWorld(config);
    const sceneSetup = createScene(worldSetup.world, config);
    const earthIndex = worldSetup.world.planets.findIndex(
      (body) => body.id === "planet:earth",
    );
    const earth = worldSetup.world.planets[earthIndex];
    const earthPhysics = worldSetup.world.planetPhysics[earthIndex];
    const mainShip = worldSetup.mainShip;
    const enemyShip = worldSetup.world.ships.find(
      (ship) => ship.id === "ship:enemy",
    );

    expect(earth).toBeDefined();
    expect(enemyShip).toBeDefined();
    expect(sceneSetup.scene.objects.some((obj) => obj.id === "ship:main")).toBe(
      true,
    );
    expect(
      sceneSetup.scene.objects.some((obj) => obj.id === "ship:enemy"),
    ).toBe(true);

    const mainOffset = vec3.subInto(
      vec3.zero(),
      mainShip.position,
      earth.position,
    );
    const enemyOffset = vec3.subInto(
      vec3.zero(),
      enemyShip!.position,
      earth.position,
    );

    expect(vec3.length(mainOffset)).toBeGreaterThan(
      earthPhysics.physicalRadius,
    );
    expect(vec3.length(enemyOffset)).toBeGreaterThan(
      earthPhysics.physicalRadius,
    );
    expect(vec3.dot(mainOffset, enemyOffset)).toBeLessThan(0);
  });
});
