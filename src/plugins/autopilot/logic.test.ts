import { describe, expect, it } from "vitest";
import { createControlInput } from "../../app/controlPorts";
import {
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
  type PropulsionCommand,
} from "../../app/controls";
import type { ShipBody, World } from "../../domain/domainPorts";
import type { LocalFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import {
  computeCircleNowAttitudeCommand,
  createCircleNowControllerState,
  resetCircleNowControllerState,
  resolveAutopilotPropulsionCommand,
  updateCircleNowControllerState,
} from "./logic";

const zeroPropulsion: PropulsionCommand = {
  main: { forward: 0 },
  rcs: { right: 0 },
};

function createWorld(frame: LocalFrame, velocity = vec3.create(0, 1500, 0)) {
  const ship: ShipBody = {
    id: "ship:test",
    position: vec3.create(10_000_000, 0, 0),
    velocity,
    frame,
    orientation: mat3.zero(),
    angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
  };
  const moon = {
    id: "planet:moon",
    position: vec3.zero(),
    velocity: vec3.zero(),
    orientation: mat3.zero(),
    rotationAxis: vec3.create(0, 0, 1),
    angularSpeedRadPerSec: 0,
  };
  mat3.copy(mat3.identity, ship.orientation);
  mat3.copy(mat3.identity, moon.orientation);

  const world: World = {
    ships: [ship],
    shipPhysics: [{ id: ship.id, density: 1, mass: 1 }],
    planets: [moon],
    planetPhysics: [
      {
        id: moon.id,
        density: 1,
        mass: 7.342e22,
        physicalRadius: 1_737_400,
      },
    ],
    stars: [],
    starPhysics: [],
  };

  return { ship, world };
}

function circleNowInput() {
  const controlInput = createControlInput(["circleNow"]);
  controlInput.circleNow = true;
  return controlInput;
}

function resolveCircleNowPropulsion(
  ship: ShipBody,
  world: World,
  phase: "acquireNose" | "acquirePlane" | "circularize",
  algorithmVersion: "v1" | "v2" | "v3" = "v2",
) {
  const controlInput = circleNowInput();
  const state = createCircleNowControllerState();
  state.phase = phase;
  state.primaryId = "planet:moon";
  return resolveAutopilotPropulsionCommand(
    1000 / 60,
    controlInput,
    ship,
    world,
    zeroPropulsion,
    maxThrustAcceleration,
    maxRcsTranslationAcceleration,
    algorithmVersion,
    state,
  );
}

describe("circle-now phased controller", () => {
  it("uses inward-only attitude and zero propulsion while acquiring the nose", () => {
    const { ship, world } = createWorld({
      right: vec3.create(0, 0, 1),
      forward: vec3.create(0, 1, 0),
      up: vec3.create(1, 0, 0),
    });
    ship.angularVelocity.roll = 1;
    const state = createCircleNowControllerState();

    const attitude = computeCircleNowAttitudeCommand(
      1000 / 60,
      ship,
      world,
      "v2",
      state,
    );
    const propulsion = resolveCircleNowPropulsion(ship, world, "acquireNose");

    expect(attitude?.roll).toBe(0);
    expect(
      Math.abs(attitude?.pitch ?? 0) + Math.abs(attitude?.yaw ?? 0),
    ).toBeGreaterThan(0);
    expect(propulsion).toEqual(zeroPropulsion);
  });

  it("uses v3 radial main thrust while acquiring with the nose aligned inward", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, 1, 0),
        forward: vec3.create(-1, 0, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.create(-2000, 1500, 0),
    );

    const propulsion = resolveCircleNowPropulsion(
      ship,
      world,
      "acquireNose",
      "v3",
    );

    expect(propulsion.main.forward).toBeLessThan(0);
    expect(propulsion.rcs.right).toBe(0);
  });

  it("keeps v3 acquisition radial thrust gated until the nose is near inward", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, 0, 1),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(1, 0, 0),
      },
      vec3.create(-2000, 1500, 0),
    );

    const propulsion = resolveCircleNowPropulsion(
      ship,
      world,
      "acquireNose",
      "v3",
    );

    expect(propulsion).toEqual(zeroPropulsion);
  });

  it("advances from nose acquisition once inward alignment is stable", () => {
    const { ship, world } = createWorld({
      right: vec3.create(0, 1, 0),
      forward: vec3.create(-1, 0, 0),
      up: vec3.create(0, 0, 1),
    });
    const state = createCircleNowControllerState();

    updateCircleNowControllerState(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      state,
    );

    expect(state.phase).toBe("acquirePlane");
  });

  it("rolls without propulsion while acquiring the orbital plane", () => {
    const { ship, world } = createWorld({
      right: vec3.create(0, 0, 1),
      forward: vec3.create(-1, 0, 0),
      up: vec3.create(0, 1, 0),
    });
    const state = createCircleNowControllerState();
    state.phase = "acquirePlane";
    state.primaryId = "planet:moon";

    const attitude = computeCircleNowAttitudeCommand(
      1000 / 60,
      ship,
      world,
      "v2",
      state,
    );
    const propulsion = resolveCircleNowPropulsion(ship, world, "acquirePlane");

    expect(Math.abs(attitude?.roll ?? 0)).toBeGreaterThan(0);
    expect(propulsion).toEqual(zeroPropulsion);
  });

  it("suppresses circularization thrust when desired acceleration is ship-up", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, 0, 1),
        forward: vec3.create(-1, 0, 0),
        up: vec3.create(0, 1, 0),
      },
      vec3.create(0, 5000, 0),
    );

    const propulsion = resolveCircleNowPropulsion(ship, world, "circularize");

    expect(propulsion).toEqual(zeroPropulsion);
  });

  it("keeps v1 immediate propulsion available during acquisition phases", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, -1, 0),
        forward: vec3.create(-1, 0, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.create(0, 5000, 0),
    );

    const propulsion = resolveCircleNowPropulsion(
      ship,
      world,
      "acquireNose",
      "v1",
    );

    expect(propulsion.rcs.right).toBeGreaterThan(0);
  });

  it("allows circularization thrust when desired acceleration is ship-right", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, -1, 0),
        forward: vec3.create(-1, 0, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.create(0, 5000, 0),
    );

    const propulsion = resolveCircleNowPropulsion(ship, world, "circularize");

    expect(propulsion.rcs.right).toBeGreaterThan(0);
  });

  it("resets when circle-now is inactive", () => {
    const { ship, world } = createWorld({
      right: vec3.create(0, 1, 0),
      forward: vec3.create(-1, 0, 0),
      up: vec3.create(0, 0, 1),
    });
    const state = createCircleNowControllerState();
    state.phase = "circularize";
    state.phaseElapsedMs = 123;
    state.primaryId = "planet:moon";
    const controlInput = createControlInput(["circleNow"]);

    updateCircleNowControllerState(1000 / 60, controlInput, ship, world, state);

    expect(state).toEqual(createCircleNowControllerState());
    resetCircleNowControllerState(state);
    expect(state).toEqual(createCircleNowControllerState());
  });
});
