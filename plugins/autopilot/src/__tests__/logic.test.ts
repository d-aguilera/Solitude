import type { ExternalControlInput } from "@solitude/plugin-api/input";
import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalControlledBody,
  ExternalEntityMotionState,
  ExternalLocalFrame,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { computeStandardGravitationalParameter } from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import {
  getAutopilotAttitudeCommand,
  resolveAutopilotPropulsionCommand,
} from "../logic";

const orbitRadius = 1_000_000;
const primaryMass = 5.972e24;
const circularSpeed = Math.sqrt(
  computeStandardGravitationalParameter(primaryMass) / orbitRadius,
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

describe("autopilot orbit mode", () => {
  it("holds prograde forward with the primary above the ship", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(0, 0, 1),
        vec3.create(0, 1, 0),
        vec3.create(-1, 0, 0),
      ),
      velocity: vec3.create(0, circularSpeed, 0),
    });
    const input = createOrbitInput();

    const command = getAutopilotAttitudeCommand(
      1000,
      ship,
      input,
      createWorld(ship),
    );

    expect(command).toBeNull();
  });

  it("rolls until the primary is above the ship", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(1, 0, 0),
        vec3.create(0, 1, 0),
        vec3.create(0, 0, 1),
      ),
      velocity: vec3.create(0, circularSpeed, 0),
    });
    const input = createOrbitInput();

    const command = getAutopilotAttitudeCommand(
      1000,
      ship,
      input,
      createWorld(ship),
    );

    expect(command).not.toBeNull();
    expect(command?.roll).toBeLessThan(0);
    expect(command?.pitch).toBeCloseTo(0);
    expect(command?.yaw).toBeCloseTo(0);
  });

  it("points the nose along full relative velocity on eccentric orbits", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(0, 0, 1),
        vec3.create(0, 1, 0),
        vec3.create(-1, 0, 0),
      ),
      velocity: vec3.create(1000, circularSpeed, 0),
    });
    const input = createOrbitInput();

    const command = getAutopilotAttitudeCommand(
      1000,
      ship,
      input,
      createWorld(ship),
    );

    expect(command).not.toBeNull();
    expect(command?.pitch).toBeLessThan(0);
    expect(command?.roll).toBeCloseTo(0);
    expect(command?.yaw).toBeCloseTo(0);
  });

  it("does not invent an orbital frame for radial-only motion", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(0, 0, 1),
        vec3.create(0, 1, 0),
        vec3.create(-1, 0, 0),
      ),
      velocity: vec3.create(-1000, 0, 0),
    });
    const input = createOrbitInput();

    const command = getAutopilotAttitudeCommand(
      1000,
      ship,
      input,
      createWorld(ship),
    );

    expect(command).toBeNull();
  });

  it("leaves propulsion under manual control", () => {
    const ship = createShip({
      frame: createFrame(
        vec3.create(0, 0, 1),
        vec3.create(0, 1, 0),
        vec3.create(-1, 0, 0),
      ),
      velocity: vec3.create(0, circularSpeed, 0),
    });
    const input = createOrbitInput();
    const manualCommand = { main: { forward: 0.5 }, rcs: { right: -0.25 } };

    const command = resolveAutopilotPropulsionCommand(
      1000,
      input,
      ship,
      createWorld(ship),
      manualCommand,
      1_000_000,
      20_000,
    );

    expect(command).toBe(manualCommand);
  });
});

function createShip({
  frame,
  velocity,
}: {
  frame: ExternalLocalFrame;
  velocity: ExternalControlledBody["velocity"];
}): ExternalControlledBody {
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "ship:test",
    position: vec3.create(orbitRadius, 0, 0),
    velocity,
  };
}

function createPrimary(): ExternalEntityMotionState {
  return {
    id: "body:primary",
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function createWorld(ship: ExternalControlledBody): ExternalWorld {
  const primary = createPrimary();
  return {
    collisionSpheres: [{ id: primary.id, radius: 1000, state: primary }],
    controllableBodies: [ship],
    entityStates: [primary, ship],
    gravityMasses: [
      {
        id: primary.id,
        mass: primaryMass,
        state: primary,
      },
    ],
  };
}

function createCircleNowInput() {
  const input: ExternalControlInput = {};
  input.circleNow = true;
  return input;
}

function createOrbitInput() {
  const input: ExternalControlInput = {};
  input.orbit = true;
  return input;
}

function createFrame(
  right: ExternalLocalFrame["right"],
  forward: ExternalLocalFrame["forward"],
  up: ExternalLocalFrame["up"],
): ExternalLocalFrame {
  return { forward, right, up };
}
