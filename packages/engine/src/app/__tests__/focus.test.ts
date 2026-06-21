import { describe, expect, it } from "vitest";
import type {
  ControlledBody,
  EntityMotionState,
  World,
} from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { updateFocusContext } from "../focus";
import type { FocusContext } from "../runtimePorts";

function createControlledBody(id: string): ControlledBody {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id,
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function createMotionState(id: string): EntityMotionState {
  return {
    id,
    orientation: mat3.identity,
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function createWorld(): {
  red: ControlledBody;
  blue: ControlledBody;
  mainFocus: FocusContext;
  world: World;
} {
  const blue = createControlledBody("ship:1");
  const red = createControlledBody("ship:red");
  const planet = createMotionState("planet:test");
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [blue, red],
    entities: [{ id: blue.id }, { id: red.id }, { id: planet.id }],
    entityIndex: new Map([
      [blue.id, { id: blue.id }],
      [red.id, { id: red.id }],
      [planet.id, { id: planet.id }],
    ]),
    entityStates: [blue, red, planet],
    gravityMasses: [],
    lightEmitters: [],
  };
  return {
    red,
    blue,
    mainFocus: {
      controlledBody: blue,
      entityId: blue.id,
    },
    world,
  };
}

describe("updateFocusContext", () => {
  it("switches the mutable focus context to another controllable body", () => {
    const { red, mainFocus, world } = createWorld();

    updateFocusContext(world, mainFocus, "ship:red");

    expect(mainFocus.entityId).toBe("ship:red");
    expect(mainFocus.controlledBody).toBe(red);
  });

  it("fails clearly when the target entity is not controllable", () => {
    const { mainFocus, world } = createWorld();

    expect(() => updateFocusContext(world, mainFocus, "planet:test")).toThrow(
      "Controlled entity not found: planet:test",
    );
  });
});
