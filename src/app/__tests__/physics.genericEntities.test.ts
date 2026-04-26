import { describe, expect, it } from "vitest";
import type { EntityMotionState, World } from "../../domain/domainPorts";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { applyCelestialSpin } from "../physics";

describe("applyCelestialSpin", () => {
  it("spins generic axial-spin capabilities", () => {
    const state: EntityMotionState = {
      id: "body:spinning",
      orientation: mat3.copy(mat3.identity, mat3.zero()),
      position: vec3.zero(),
      velocity: vec3.zero(),
    };
    const world: World = {
      axialSpins: [
        {
          angularSpeedRadPerSec: Math.PI,
          id: state.id,
          rotationAxis: vec3.create(0, 0, 1),
          state,
        },
      ],
      collisionSpheres: [],
      controllableBodies: [],
      entities: [{ id: state.id }],
      entityIndex: new Map([[state.id, { id: state.id }]]),
      entityStates: [state],
      gravityMasses: [],
      lightEmitters: [],
      ships: [],
      shipPhysics: [],
      planets: [],
      planetPhysics: [],
      stars: [],
      starPhysics: [],
    };

    applyCelestialSpin(500, world);

    expect(state.orientation[0][0]).toBeCloseTo(0);
    expect(state.orientation[1][0]).toBeCloseTo(1);
  });
});
