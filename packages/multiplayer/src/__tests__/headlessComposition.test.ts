import {
  controllableEntityProviderCapability,
  type ControllableEntityProvider,
} from "@solitude/engine/controllable-entities";
import { vec3 } from "@solitude/engine/math";
import type { PluginFactory } from "@solitude/engine/plugin";
import type { ControlledBody } from "@solitude/engine/world";
import { createSolitudeHeadlessLoop } from "@solitude/sim/headless";
import { describe, expect, it } from "vitest";
import {
  createDefaultMultiplayerSpacecraftEntity,
  createDefaultMultiplayerSpawnProviders,
  type DefaultMultiplayerContentPluginSet,
} from "../composition";
import { testMultiplayerContentPlugins } from "./polyFighterFixture";

describe("server-style headless Solitude composition", () => {
  it("builds the default Solitude world through public exports and advances spacecraft dynamics", () => {
    const { config, loop } = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    });
    const world = loop.worldAndScene.world;
    const focus = loop.worldAndScene.mainFocus;

    expect(config.mainFocusEntityId).toBe("ship:1");
    expect(world.controllableBodies.map((body) => body.id)).toEqual([
      "ship:1",
      "ship:red",
    ]);
    expect(focus.entityId).toBe("ship:1");

    const before = vec3.clone(focus.controlledBody.velocity);

    loop.step(1000, { burnForward: true, thrust5: true });

    const velocityDelta = vec3.length(
      vec3.subInto(vec3.zero(), focus.controlledBody.velocity, before),
    );
    expect(velocityDelta).toBeGreaterThan(0);
  });

  it("can route controls to multiple ships in one authoritative headless tick", () => {
    const { loop } = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    });
    const blue = getControlledBody(loop.worldAndScene.world, "ship:1");
    const red = getControlledBody(loop.worldAndScene.world, "ship:red");
    const blueBefore = vec3.clone(blue.velocity);
    const redBefore = vec3.clone(red.velocity);

    loop.stepWithEntityInputs(
      1000,
      new Map([
        ["ship:1", { burnForward: true, thrust5: true }],
        ["ship:red", { burnRight: true }],
      ]),
    );

    const blueVelocityDelta = vec3.length(
      vec3.subInto(vec3.zero(), blue.velocity, blueBefore),
    );
    const redVelocityDelta = vec3.length(
      vec3.subInto(vec3.zero(), red.velocity, redBefore),
    );
    expect(blueVelocityDelta).toBeGreaterThan(1000);
    expect(redVelocityDelta).toBeGreaterThan(1000);
  });

  it("can advance simulation time independently from control time", () => {
    const noBurnLoop = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    }).loop;
    const shortBurnLoop = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    }).loop;
    const fullBurnLoop = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    }).loop;
    const shortYawLoop = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    }).loop;
    const fullYawLoop = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    }).loop;

    noBurnLoop.stepWithEntityInputsAndSimDt(100, 1000, new Map());
    shortBurnLoop.stepWithEntityInputsAndSimDt(
      100,
      1000,
      new Map([["ship:1", { burnForward: true, thrust5: true }]]),
    );
    fullBurnLoop.stepWithEntityInputsAndSimDt(
      1000,
      1000,
      new Map([["ship:1", { burnForward: true, thrust5: true }]]),
    );
    shortYawLoop.stepWithEntityInputsAndSimDt(
      100,
      1000,
      new Map([["ship:1", { yawLeft: true }]]),
    );
    fullYawLoop.stepWithEntityInputsAndSimDt(
      1000,
      1000,
      new Map([["ship:1", { yawLeft: true }]]),
    );

    const noBurnBlue = getControlledBody(
      noBurnLoop.worldAndScene.world,
      "ship:1",
    );
    const shortBurnBlue = getControlledBody(
      shortBurnLoop.worldAndScene.world,
      "ship:1",
    );
    const fullBurnBlue = getControlledBody(
      fullBurnLoop.worldAndScene.world,
      "ship:1",
    );
    const shortYawBlue = getControlledBody(
      shortYawLoop.worldAndScene.world,
      "ship:1",
    );
    const fullYawBlue = getControlledBody(
      fullYawLoop.worldAndScene.world,
      "ship:1",
    );
    const shortBurnVelocityDelta = vec3.length(
      vec3.subInto(vec3.zero(), shortBurnBlue.velocity, noBurnBlue.velocity),
    );
    const fullBurnVelocityDelta = vec3.length(
      vec3.subInto(vec3.zero(), fullBurnBlue.velocity, noBurnBlue.velocity),
    );

    expect(shortBurnVelocityDelta).toBeGreaterThan(0);
    expect(shortBurnVelocityDelta).toBeCloseTo(fullBurnVelocityDelta);
    expect(Math.abs(shortYawBlue.angularVelocity.yaw)).toBeLessThan(
      Math.abs(fullYawBlue.angularVelocity.yaw),
    );
  });

  it("assigns distinct display colors without server-authored names", () => {
    const spawnProviders = createDefaultMultiplayerSpawnProviders(
      testMultiplayerContentPlugins,
      {},
    );
    const ships = [
      createDefaultMultiplayerSpacecraftEntity({
        ...spawnProviders,
        entityCount: 16,
        id: "ship:1",
        index: 0,
      }),
      createDefaultMultiplayerSpacecraftEntity({
        ...spawnProviders,
        entityCount: 16,
        id: "ship:red",
        index: 1,
      }),
      createDefaultMultiplayerSpacecraftEntity({
        ...spawnProviders,
        entityCount: 16,
        id: "ship:3",
        index: 2,
      }),
    ];

    expect(ships.map((ship) => ship.displayName)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ships.map((ship) => ship.components.renderable?.color)).toEqual([
      { r: 64, g: 180, b: 255 },
      { r: 255, g: 80, b: 80 },
      { r: 255, g: 210, b: 64 },
    ]);
  });

  it("requires one controllable entity provider", () => {
    expect(() =>
      createDefaultMultiplayerSpawnProviders({ catalog: {}, ids: [] }, {}),
    ).toThrowError(
      "Expected exactly one controllable entity provider, found 0",
    );
  });

  it("rejects ambiguous controllable entity providers", () => {
    expect(() =>
      createDefaultMultiplayerSpawnProviders(
        createContentPluginSetWithProviders(["fighter", "shuttle"]),
        {},
      ),
    ).toThrowError(
      "Expected exactly one controllable entity provider, found 2",
    );
  });
});

function createContentPluginSetWithProviders(
  providerIds: readonly string[],
): DefaultMultiplayerContentPluginSet {
  const catalog = Object.fromEntries(
    providerIds.map((id) => [id, createControllableEntityPlugin(id)]),
  );
  return { catalog, ids: providerIds };
}

function createControllableEntityPlugin(id: string): PluginFactory {
  const provider: ControllableEntityProvider = {
    createEntity: () => {
      throw new Error("Not used by provider selection");
    },
    id,
    mass: 1,
  };
  return () => ({
    capabilities: [
      { id: controllableEntityProviderCapability, value: provider },
    ],
    id,
  });
}

function createDefaultShipEntities() {
  const spawnProviders = createDefaultMultiplayerSpawnProviders(
    testMultiplayerContentPlugins,
    {},
  );
  return [
    createDefaultMultiplayerSpacecraftEntity({
      ...spawnProviders,
      entityCount: 16,
      id: "ship:1",
      index: 0,
    }),
    createDefaultMultiplayerSpacecraftEntity({
      ...spawnProviders,
      entityCount: 16,
      id: "ship:red",
      index: 1,
    }),
  ];
}

function getControlledBody(
  world: { controllableBodies: ControlledBody[] },
  id: string,
): ControlledBody {
  const body = world.controllableBodies.find((item) => item.id === id);
  if (!body) throw new Error(`Missing controlled body: ${id}`);
  return body;
}
