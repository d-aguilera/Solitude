import type { EntityConfig } from "@solitude/engine/app/entityConfigPorts";
import type { WorldModelRegistry } from "@solitude/engine/app/pluginPorts";
import { applyWorldModelPlugins } from "@solitude/engine/app/worldModelConfig";
import { vec3 } from "@solitude/engine/domain/vec3";
import { createScene } from "@solitude/engine/setup/sceneSetup";
import { createWorld } from "@solitude/engine/setup/setup";
import { describe, expect, it, vi } from "vitest";
import { buildWorldAndSceneConfig } from "../../config/worldAndSceneConfig";
import { createSolarSystemPlugin } from "./index";

describe("solarSystem plugin", () => {
  it("contributes world content through generic entities", () => {
    const config = buildWorldAndSceneConfig();
    const addEntities = vi.fn<WorldModelRegistry["addEntities"]>();
    const registry: WorldModelRegistry = {
      addEntities,
      setMainFocusEntityId: vi.fn(),
    };

    createSolarSystemPlugin().worldModel!.contributeWorldModel(registry, {
      config,
    });

    expect(registry.addEntities).toHaveBeenCalledOnce();
    expect(registry.setMainFocusEntityId).toHaveBeenCalledWith("ship:blue");
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
      "ship:blue",
      "ship:red",
    ]);
  });

  it("contributes solar bodies, main focus, and red ship", () => {
    const config = buildWorldAndSceneConfig();

    applyWorldModelPlugins(config, [createSolarSystemPlugin()]);
    expect(config.mainFocusEntityId).toBe("ship:blue");
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
      "ship:blue",
      "ship:red",
    ]);
    expect(config.entities[0].components.lightEmitter?.luminosity).toBeTruthy();
    expect(
      config.entities.find((entity) => entity.id === "ship:blue")?.components
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
    const blueFocusedBody = worldSetup.mainFocus.controlledBody;
    const redShip = worldSetup.world.controllableBodies.find(
      (ship) => ship.id === "ship:red",
    );

    expect(worldSetup.mainFocus.entityId).toBe("ship:blue");
    expect(blueFocusedBody.id).toBe("ship:blue");
    expect(worldSetup.world.entities.map((entity) => entity.id)).toEqual(
      config.entities.map((entity) => entity.id),
    );
    expect(worldSetup.world.controllableBodies.map((body) => body.id)).toEqual([
      "ship:blue",
      "ship:red",
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
