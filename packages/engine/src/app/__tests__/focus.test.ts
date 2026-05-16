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
  enemy: ControlledBody;
  main: ControlledBody;
  mainFocus: FocusContext;
  world: World;
} {
  const main = createControlledBody("ship:main");
  const enemy = createControlledBody("ship:enemy");
  const planet = createMotionState("planet:test");
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [main, enemy],
    entities: [{ id: main.id }, { id: enemy.id }, { id: planet.id }],
    entityIndex: new Map([
      [main.id, { id: main.id }],
      [enemy.id, { id: enemy.id }],
      [planet.id, { id: planet.id }],
    ]),
    entityStates: [main, enemy, planet],
    gravityMasses: [],
    lightEmitters: [],
  };
  return {
    enemy,
    main,
    mainFocus: {
      controlledBody: main,
      entityId: main.id,
    },
    world,
  };
}

describe("updateFocusContext", () => {
  it("switches the mutable focus context to another controllable body", () => {
    const { enemy, mainFocus, world } = createWorld();

    updateFocusContext(world, mainFocus, "ship:enemy");

    expect(mainFocus.entityId).toBe("ship:enemy");
    expect(mainFocus.controlledBody).toBe(enemy);
  });

  it("fails clearly when the target entity is not controllable", () => {
    const { mainFocus, world } = createWorld();

    expect(() => updateFocusContext(world, mainFocus, "planet:test")).toThrow(
      "Controlled entity not found: planet:test",
    );
  });
});
