import { vec3 } from "@solitude/plugin-api/math";
import { describe, expect, it } from "vitest";
import { createPlugin, NewtonianGravityEngine } from "../index";

describe("Newtonian gravity", () => {
  it("creates independent engines per runtime", () => {
    const provider = createPlugin().gravity;
    expect(provider?.createGravityEngine()).not.toBe(
      provider?.createGravityEngine(),
    );
  });

  it("applies equal and opposite two-body acceleration", () => {
    const engine = new NewtonianGravityEngine(1, 0);
    const leftVelocity = vec3.zero();
    const rightVelocity = vec3.zero();
    const leftPosition = vec3.create(-1, 0, 0);
    const rightPosition = vec3.create(1, 0, 0);

    engine.step(1, {
      bodyStates: [
        { mass: 1, velocity: leftVelocity },
        { mass: 1, velocity: rightVelocity },
      ],
      positions: [leftPosition, rightPosition],
    });

    expect(leftVelocity.x).toBeGreaterThan(0);
    expect(rightVelocity.x).toBeLessThan(0);
    expect(leftVelocity.x).toBeCloseTo(-rightVelocity.x);
    expect(leftPosition.x).toBeCloseTo(-rightPosition.x);
  });
});
