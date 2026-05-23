import { vec3 } from "@solitude/engine/math";
import type { ControlledBody } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import { createSolitudeServerGame } from "../runtime";

describe("Solitude server runtime", () => {
  it("steps the default headless game with entity-addressed controls and reuses snapshots", () => {
    const game = createSolitudeServerGame();
    const blue = getControlledBody(game.worldAndScene, "ship:blue");
    const red = getControlledBody(game.worldAndScene, "ship:red");
    const blueBefore = vec3.clone(blue.velocity);
    const redBefore = vec3.clone(red.velocity);
    const snapshot = game.snapshot;
    const firstEntitySnapshot = snapshot.entities[0];
    const firstPositionSnapshot = firstEntitySnapshot.position;

    const nextSnapshot = game.step(
      1000,
      new Map([
        ["ship:blue", { burnForward: true, thrust5: true }],
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
});

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
