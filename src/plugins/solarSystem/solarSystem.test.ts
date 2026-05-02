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
      setMainFocusEntityId: vi.fn(),
      setMainControlledEntityId: vi.fn(),
    };

    createSolarSystemPlugin().worldModel!.contributeWorldModel(registry, {
      config,
    });

    expect(registry.addEntities).toHaveBeenCalledOnce();
    expect(registry.setMainFocusEntityId).toHaveBeenCalledWith("ship:main");
    expect(registry.setMainControlledEntityId).not.toHaveBeenCalled();
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

  it("contributes solar bodies, main focus, and enemy ship", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);
    expect(config.mainFocusEntityId).toBe("ship:main");
    expect(config.mainControlledEntityId).toBe("ship:main");
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

  it("keeps legacy world-model focus registration compatible", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [
      {
        id: "legacy-focus-plugin",
        worldModel: {
          contributeWorldModel: (registry) => {
            registry.setMainControlledEntityId("ship:legacy");
          },
        },
      },
    ]);

    expect(config.mainFocusEntityId).toBe("ship:legacy");
    expect(config.mainControlledEntityId).toBe("ship:legacy");
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
    const mainFocusedBody = worldSetup.mainFocus.controlledBody;
    const enemyShip = worldSetup.world.controllableBodies.find(
      (ship) => ship.id === "ship:enemy",
    );

    expect(worldSetup.mainFocus.entityId).toBe("ship:main");
    expect(mainFocusedBody.id).toBe("ship:main");
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
      mainFocusedBody.position,
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
