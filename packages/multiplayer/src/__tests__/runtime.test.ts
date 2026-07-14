import { vec3 } from "@solitude/engine/math";
import type { ControlledBody } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import {
  createDefaultMultiplayerSpacecraftEntity,
  createDefaultMultiplayerSpawnProviders,
} from "../composition";
import { createSolitudeServerGame } from "../runtime";
import { testMultiplayerContentPlugins } from "./polyFighterFixture";

describe("Solitude server runtime", () => {
  it("steps the default headless game with entity-addressed controls and reuses snapshots", () => {
    const game = createSolitudeServerGame(createDefaultShipEntities());
    const blue = getControlledBody(game.worldAndScene, "ship:1");
    const red = getControlledBody(game.worldAndScene, "ship:red");
    const blueBefore = vec3.clone(blue.velocity);
    const redBefore = vec3.clone(red.velocity);
    const snapshot = game.snapshot;
    const firstEntitySnapshot = snapshot.entities[0];
    const firstPositionSnapshot = firstEntitySnapshot.position;

    const nextSnapshot = game.step(
      1000,
      1000,
      new Map([
        ["ship:1", { burnForward: true, thrust5: true }],
        ["ship:red", { burnRight: true }],
      ]),
    );

    expect(nextSnapshot).toBe(snapshot);
    expect(nextSnapshot.entities[0]).toBe(firstEntitySnapshot);
    expect(nextSnapshot.entities[0].position).toBe(firstPositionSnapshot);
    expect(
      vec3.length(vec3.subInto(vec3.zero(), blue.velocity, blueBefore)),
    ).toBeGreaterThan(1000);
    expect(
      vec3.length(vec3.subInto(vec3.zero(), red.velocity, redBefore)),
    ).toBeGreaterThan(1000);
  });

  it("moves runtime focus away from a removed focused entity", () => {
    const game = createSolitudeServerGame(createDefaultShipEntities());

    expect(game.worldAndScene.mainFocus.entityId).toBe("ship:1");

    game.removeEntity("ship:1");

    expect(game.worldAndScene.mainFocus.entityId).toBe("ship:red");
    expect(game.worldAndScene.mainFocus.controlledBody.id).toBe("ship:red");
    expect(
      game.worldAndScene.world.controllableBodies.some(
        (body) => body.id === "ship:1",
      ),
    ).toBe(false);
  });

  it("advances dynamically added ships through gravity integration", () => {
    const spawnProviders = createDefaultMultiplayerSpawnProviders(
      testMultiplayerContentPlugins,
      {},
    );
    const blue = createDefaultMultiplayerSpacecraftEntity({
      ...spawnProviders,
      entityCount: 16,
      id: "ship:1",
      index: 0,
    });
    const red = createDefaultMultiplayerSpacecraftEntity({
      ...spawnProviders,
      entityCount: 16,
      id: "ship:red",
      index: 1,
    });
    const game = createSolitudeServerGame([blue]);
    game.addEntity(red);
    const redBody = getControlledBody(game.worldAndScene, "ship:red");
    const redPositionBefore = vec3.clone(redBody.position);

    game.step(
      1000,
      1000,
      new Map([["ship:red", { burnForward: true, thrust5: true }]]),
    );

    expect(
      vec3.length(
        vec3.subInto(vec3.zero(), redBody.position, redPositionBefore),
      ),
    ).toBeGreaterThan(0);
  });
});

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
  worldAndScene: {
    world: { controllableBodies: ControlledBody[] };
  },
  id: string,
): ControlledBody {
  const body = worldAndScene.world.controllableBodies.find(
    (item) => item.id === id,
  );
  if (!body) throw new Error(`Missing controlled body: ${id}`);
  return body;
}
