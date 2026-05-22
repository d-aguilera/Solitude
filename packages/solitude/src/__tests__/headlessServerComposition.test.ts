import { vec3 } from "@solitude/engine/math";
import { createSolitudeHeadlessLoop } from "solitude/headless";
import { describe, expect, it } from "vitest";

describe("server-style headless Solitude composition", () => {
  it("builds the default Solitude world through public exports and advances spacecraft dynamics", () => {
    const { config, loop } = createSolitudeHeadlessLoop();
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
});
