import { localFrame, mat3, vec3, type LocalFrame } from "@solitude/engine/math";
import { createControlInput } from "@solitude/engine/plugin";
import { parameters } from "@solitude/engine/runtime";
import type {
  ControlledBody,
  EntityMotionState,
  World,
} from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import {
  getAutopilotAttitudeCommand,
  resolveAutopilotPropulsionCommand,
} from "./logic";

const orbitRadius = 1_000_000;
const primaryMass = 5.972e24;
const circularSpeed = Math.sqrt(
  (parameters.newtonG * primaryMass) / orbitRadius,
);

describe("autopilot circle now v2", () => {
  it("turns the strong thrust axis toward the circularization correction", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(0, 1, 0),
        vec3.create(-1, 0, 0),
        vec3.create(0, 0, 1),
      ),
      velocity: vec3.zero(),
    });
    const input = createCircleNowInput();

    const command = getAutopilotAttitudeCommand(
      1000,
      ship,
      input,
      createWorld(ship),
    );

    expect(command).not.toBeNull();
    expect(command?.yaw).toBeLessThan(0);
  });

  it("faces the dominant body once the local orbit is circular", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(1, 0, 0),
        vec3.create(0, 1, 0),
        vec3.create(0, 0, 1),
      ),
      velocity: vec3.create(0, circularSpeed, 0),
    });
    const input = createCircleNowInput();

    const command = getAutopilotAttitudeCommand(
      1000,
      ship,
      input,
      createWorld(ship),
    );

    expect(command).not.toBeNull();
    expect(command?.yaw).toBeGreaterThan(0);
  });

  it("does not roll-flip while holding an almost circular inward-facing orbit", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(0, 1, 0),
        vec3.create(-1, 0, 0),
        vec3.create(0, 0, 1),
      ),
      velocity: vec3.create(0, circularSpeed * 1.001, 0),
    });
    const input = createCircleNowInput();

    const command = getAutopilotAttitudeCommand(
      1000,
      ship,
      input,
      createWorld(ship),
    );

    expect(command?.roll ?? 0).toBeCloseTo(0);
  });

  it("uses main thrust when the nose is aligned with the circularization correction", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(1, 0, 0),
        vec3.create(0, 1, 0),
        vec3.create(0, 0, 1),
      ),
      velocity: vec3.create(0, circularSpeed * 0.5, 0),
    });
    const input = createCircleNowInput();

    const command = resolveAutopilotPropulsionCommand(
      1000,
      input,
      ship,
      createWorld(ship),
      { main: { forward: 0 }, rcs: { right: 0 } },
      1_000_000,
      20_000,
    );

    expect(command.main.forward).toBeGreaterThan(0);
    expect(Math.abs(command.rcs.right)).toBeLessThan(1e-9);
  });
});

function createShip({
  frame,
  velocity,
}: {
  frame: LocalFrame;
  velocity: ControlledBody["velocity"];
}): ControlledBody {
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "ship:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(orbitRadius, 0, 0),
    velocity,
  };
}

function createPrimary(): EntityMotionState {
  const frame = createFrame(
    vec3.create(1, 0, 0),
    vec3.create(0, 1, 0),
    vec3.create(0, 0, 1),
  );
  return {
    id: "body:primary",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function createWorld(ship: ControlledBody): World {
  const primary = createPrimary();
  return {
    axialSpins: [],
    collisionSpheres: [{ id: primary.id, radius: 1000, state: primary }],
    controllableBodies: [ship],
    entities: [{ id: primary.id }, { id: ship.id }],
    entityIndex: new Map([
      [primary.id, { id: primary.id }],
      [ship.id, { id: ship.id }],
    ]),
    entityStates: [primary, ship],
    gravityMasses: [
      {
        density: 1,
        id: primary.id,
        mass: primaryMass,
        state: primary,
      },
    ],
    lightEmitters: [],
  };
}

function createCircleNowInput() {
  const input = createControlInput(["circleNow"]);
  input.circleNow = true;
  return input;
}

function createFrame(
  right: LocalFrame["right"],
  forward: LocalFrame["forward"],
  up: LocalFrame["up"],
): LocalFrame {
  return { forward, right, up };
}
