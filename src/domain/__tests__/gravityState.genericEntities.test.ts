import { describe, expect, it } from "vitest";
import type { EntityMotionState, World } from "../domainPorts";
import { buildInitialGravityState } from "../gravityState";
import { mat3 } from "../mat3";
import { vec3 } from "../vec3";

function createWorldWithGravityState(state: EntityMotionState): World {
  return {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [],
    entities: [{ id: state.id }],
    entityIndex: new Map([[state.id, { id: state.id }]]),
    entityStates: [state],
    gravityMasses: [{ id: state.id, density: 1, mass: 42, state }],
    lightEmitters: [],
    ships: [],
    shipPhysics: [],
    planets: [],
    planetPhysics: [],
    stars: [],
    starPhysics: [],
  };
}

describe("buildInitialGravityState", () => {
  it("builds gravity aliases from generic mass capabilities", () => {
    const state: EntityMotionState = {
      id: "body:test",
      orientation: mat3.copy(mat3.identity, mat3.zero()),
      position: vec3.create(1, 2, 3),
      velocity: vec3.create(4, 5, 6),
    };
    const gravityState = buildInitialGravityState(
      createWorldWithGravityState(state),
    );

    expect(gravityState.bodyStates).toEqual([
      { id: "body:test", mass: 42, velocity: state.velocity },
    ]);
    expect(gravityState.positions).toEqual([state.position]);
    expect(gravityState.bodyStates[0].velocity).toBe(state.velocity);
    expect(gravityState.positions[0]).toBe(state.position);
  });
});
