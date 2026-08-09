import { vec3 } from "@solitude/plugin-api/math";
import { describe, expect, it } from "vitest";
import {
  createPlugin,
  DEFAULT_MAX_GRAVITY_STEP_SECONDS,
  getGravitySubstepCount,
  maxGravityStepSecondsRuntimeOption,
  NewtonianGravityEngine,
} from "../index";

describe("Newtonian gravity", () => {
  it("creates independent engines per runtime", () => {
    const provider = createPlugin().gravity;
    expect(provider?.createGravityEngine()).not.toBe(
      provider?.createGravityEngine(),
    );
  });

  it("applies equal and opposite two-body acceleration", () => {
    const engine = new NewtonianGravityEngine(1, 0, 10);
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

  it("bounds substeps independently of the requested interval", () => {
    expect(getGravitySubstepCount(0, 10)).toBe(1);
    expect(getGravitySubstepCount(10, 10)).toBe(1);
    expect(getGravitySubstepCount(10.001, 10)).toBe(2);
    expect(getGravitySubstepCount(100, 10)).toBe(10);
  });

  it("validates maximum-step runtime configuration", () => {
    expect(
      createPlugin({ [maxGravityStepSecondsRuntimeOption]: "2" }).gravity,
    ).toBeDefined();
    expect(() =>
      createPlugin({ [maxGravityStepSecondsRuntimeOption]: "0" }),
    ).toThrow("must be a positive finite number");
    expect(() =>
      createPlugin({ [maxGravityStepSecondsRuntimeOption]: "fast" }),
    ).toThrow("must be a positive finite number");
  });

  it("keeps low Earth orbit energy bounded across a full orbit", () => {
    const gravitationalConstant = 6.6743e-11;
    const earthMass = 5.972e24;
    const orbitalRadius = 6_371_000 + 400_000;
    const orbitalSpeed = Math.sqrt(
      (gravitationalConstant * earthMass) / orbitalRadius,
    );
    const orbitalPeriod = (2 * Math.PI * orbitalRadius) / orbitalSpeed;
    const earthPosition = vec3.zero();
    const craftPosition = vec3.create(orbitalRadius, 0, 0);
    const earthVelocity = vec3.zero();
    const craftVelocity = vec3.create(0, orbitalSpeed, 0);
    const state = {
      bodyStates: [
        { mass: earthMass, velocity: earthVelocity },
        { mass: 1_000, velocity: craftVelocity },
      ],
      positions: [earthPosition, craftPosition],
    };
    const initialEnergy = specificOrbitalEnergy(
      gravitationalConstant,
      earthMass,
      earthPosition,
      craftPosition,
      earthVelocity,
      craftVelocity,
    );

    new NewtonianGravityEngine(
      gravitationalConstant,
      0,
      DEFAULT_MAX_GRAVITY_STEP_SECONDS,
    ).step(orbitalPeriod, state);

    const finalEnergy = specificOrbitalEnergy(
      gravitationalConstant,
      earthMass,
      earthPosition,
      craftPosition,
      earthVelocity,
      craftVelocity,
    );
    expect(
      Math.abs((finalEnergy - initialEnergy) / initialEnergy),
    ).toBeLessThan(1e-6);
    expect(
      vec3.length(vec3.subInto(vec3.zero(), craftPosition, earthPosition)),
    ).toBeCloseTo(orbitalRadius, -1);
  });
});

function specificOrbitalEnergy(
  gravitationalConstant: number,
  primaryMass: number,
  primaryPosition: { x: number; y: number; z: number },
  secondaryPosition: { x: number; y: number; z: number },
  primaryVelocity: { x: number; y: number; z: number },
  secondaryVelocity: { x: number; y: number; z: number },
): number {
  const dx = secondaryPosition.x - primaryPosition.x;
  const dy = secondaryPosition.y - primaryPosition.y;
  const dz = secondaryPosition.z - primaryPosition.z;
  const dvx = secondaryVelocity.x - primaryVelocity.x;
  const dvy = secondaryVelocity.y - primaryVelocity.y;
  const dvz = secondaryVelocity.z - primaryVelocity.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const speedSq = dvx * dvx + dvy * dvy + dvz * dvz;
  return speedSq * 0.5 - (gravitationalConstant * primaryMass) / distance;
}
