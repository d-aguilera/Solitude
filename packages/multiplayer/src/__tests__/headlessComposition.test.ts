import { vec3 } from "@solitude/engine/math";
import type { ControlledBody } from "@solitude/engine/world";
import { createSolitudeHeadlessLoop } from "@solitude/sim/headless";
import { describe, expect, it } from "vitest";
import { createDefaultMultiplayerSpacecraftEntity } from "../composition";

describe("server-style headless Solitude composition", () => {
  it("builds the default Solitude world through public exports and advances spacecraft dynamics", () => {
    const { config, loop } = createSolitudeHeadlessLoop({
      extraEntities: createDefaultShipEntities(),
    });
    const world = loop.worldAndScene.world;
    const focus = loop.worldAndScene.mainFocus;

    expect(config.mainFocusEntityId).toBe("ship:blue");
    expect(world.controllableBodies.map((body) => body.id)).toEqual([
      "ship:blue",
      "ship:red",
    ]);
    expect(focus.entityId).toBe("ship:blue");

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
    const blue = getControlledBody(loop.worldAndScene.world, "ship:blue");
    const red = getControlledBody(loop.worldAndScene.world, "ship:red");
    const blueBefore = vec3.clone(blue.velocity);
    const redBefore = vec3.clone(red.velocity);

    loop.stepWithEntityInputs(
      1000,
      new Map([
        ["ship:blue", { burnForward: true, thrust5: true }],
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
});

function createDefaultShipEntities() {
  return [
    createDefaultMultiplayerSpacecraftEntity({
      entityCount: 16,
      id: "ship:blue",
      index: 0,
    }),
    createDefaultMultiplayerSpacecraftEntity({
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
