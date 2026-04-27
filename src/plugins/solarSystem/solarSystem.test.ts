import { describe, expect, it, vi } from "vitest";
import type { EntityConfig } from "../../app/entityConfigPorts";
import type { WorldModelRegistry } from "../../app/pluginPorts";
import { applyWorldModelPlugins } from "../../app/worldModelConfig";
import { buildWorldAndSceneConfig } from "../../config/worldAndSceneConfig";
import { vec3 } from "../../domain/vec3";
import { createScene } from "../../setup/sceneSetup";
import { createWorld } from "../../setup/setup";
import { createSolarSystemPlugin } from "./index";

describe("solarSystem plugin", () => {
  it("contributes world content through generic entities", () => {
    const config = buildWorldAndSceneConfig();
    const addEntities = vi.fn<WorldModelRegistry["addEntities"]>();
    const registry: WorldModelRegistry = {
      addEntities,
      setMainControlledEntityId: vi.fn(),
      setMainShipId: vi.fn(),
    };

    createSolarSystemPlugin().worldModel!.contributeWorldModel(registry, {
      config,
    });

    expect(registry.addEntities).toHaveBeenCalledOnce();
    expect(registry.setMainShipId).toHaveBeenCalledWith("ship:main");
    expect(
      addEntities.mock.calls[0][0].map((entity: EntityConfig) => entity.id),
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
      "ship:main",
      "ship:enemy",
    ]);
  });

  it("contributes solar bodies, main ship, and enemy ship", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);

    expect(config.mainShipId).toBe("ship:main");
    expect(config.mainControlledEntityId).toBe("ship:main");
    expect(config.physics.planets).toEqual([]);
    expect(config.physics.ships).toEqual([]);
    expect(config.render.planets).toEqual([]);
    expect(config.render.ships).toEqual([]);
    expect(config.physics.shipInitialStates).toEqual([]);
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
    const earth = worldSetup.world.entityStates.find(
      (entity) => entity.id === "planet:earth",
    );
    const earthSphere = worldSetup.world.collisionSpheres.find(
      (sphere) => sphere.id === "planet:earth",
    );
    const mainShip = worldSetup.mainShip;
    const enemyShip = worldSetup.world.controllableBodies.find(
      (ship) => ship.id === "ship:enemy",
    );

    expect(worldSetup.mainControlledBody).toBe(mainShip);
    expect(worldSetup.world.entities.map((entity) => entity.id)).toEqual(
      config.entities.map((entity) => entity.id),
    );
    expect(worldSetup.world.controllableBodies.map((body) => body.id)).toEqual([
      "ship:main",
      "ship:enemy",
    ]);
    expect(worldSetup.world.gravityMasses.map((mass) => mass.id)).toEqual(
      config.entities.map((entity) => entity.id),
    );
    expect(
      worldSetup.world.collisionSpheres.some(
        (sphere) => sphere.id === "planet:earth",
      ),
    ).toBe(true);
    expect(
      worldSetup.world.lightEmitters.some((light) => light.id === "planet:sun"),
    ).toBe(true);
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
      earth!.position,
    );
    const enemyOffset = vec3.subInto(
      vec3.zero(),
      enemyShip!.position,
      earth!.position,
    );

    expect(vec3.length(mainOffset)).toBeGreaterThan(earthSphere!.radius);
    expect(vec3.length(enemyOffset)).toBeGreaterThan(earthSphere!.radius);
    expect(vec3.dot(mainOffset, enemyOffset)).toBeLessThan(0);
  });
});
