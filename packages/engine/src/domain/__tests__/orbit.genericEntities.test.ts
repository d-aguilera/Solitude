import { describe, expect, it } from "vitest";
import type { ControlledBody, EntityMotionState, World } from "../domainPorts";
import { localFrame } from "../localFrame";
import { mat3 } from "../mat3";
import {
  computeOrbitReadoutInto,
  createOrbitReadout,
  getDominantBodyPrimary,
} from "../orbit";
import { vec3 } from "../vec3";

function createState(id: string, x: number, mass: number, radius: number) {
  const state: EntityMotionState = {
    id,
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.create(x, 0, 0),
    velocity: vec3.zero(),
  };
  return {
    gravityMass: { id, density: 1, mass, state },
    sphere: { id, radius, state },
    state,
  };
}

function createControlledBody(): ControlledBody {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "craft:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(10, 0, 0),
    velocity: vec3.create(0, 1, 0),
  };
}

describe("orbit helpers", () => {
  it("find dominant primary from generic gravity and collision capabilities", () => {
    const near = createState("body:near", 0, 100, 2);
    const far = createState("body:far", 1000, 1_000, 3);
    const controlledBody = createControlledBody();
    const world: World = {
      axialSpins: [],
      collisionSpheres: [near.sphere, far.sphere],
      controllableBodies: [controlledBody],
      entities: [
        { id: near.state.id },
        { id: far.state.id },
        { id: controlledBody.id },
      ],
      entityIndex: new Map(),
      entityStates: [near.state, far.state, controlledBody],
      gravityMasses: [near.gravityMass, far.gravityMass],
      lightEmitters: [],
    };

    const primary = getDominantBodyPrimary(world, controlledBody.position);
    const readout = createOrbitReadout();

    expect(primary?.id).toBe("body:near");
    expect(primary?.body).toBe(near.state);
    expect(primary?.radius).toBe(2);
    expect(computeOrbitReadoutInto(readout, world, controlledBody)).toBe(true);
    expect(readout.primaryId).toBe("body:near");
  });
});
