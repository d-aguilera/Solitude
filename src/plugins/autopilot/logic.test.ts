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
import { parameters } from "../../global/parameters";
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
  phase: "calibrateSpeed" | "acquireNose" | "acquirePlane" | "circularize",
  algorithmVersion: "v1" | "v2" | "v3" | "v4" | "v5" = "v2",
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
  it("locks v5 to the activation primary and orbital plane", () => {
    const { ship, world } = createWorld({
      right: vec3.create(1, 0, 0),
      forward: vec3.create(0, 1, 0),
      up: vec3.create(0, 0, 1),
    });
    const state = createCircleNowControllerState();

    updateCircleNowControllerState(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      state,
      "v5",
    );

    expect(state.phase).toBe("vectorCircularize");
    expect(state.primaryId).toBe("planet:moon");
    expect(state.hasLockedPlane).toBe(true);
    expect(state.lockedPlaneNormal.z).toBeCloseTo(1);

    const earth = {
      id: "planet:earth",
      position: vec3.create(9_900_000, 0, 0),
      velocity: vec3.zero(),
      orientation: mat3.zero(),
      rotationAxis: vec3.create(0, 0, 1),
      angularSpeedRadPerSec: 0,
    };
    mat3.copy(mat3.identity, earth.orientation);
    world.planets.push(earth);
    world.planetPhysics.push({
      id: earth.id,
      density: 1,
      mass: 5.972e24,
      physicalRadius: 6_371_000,
    });

    updateCircleNowControllerState(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      state,
      "v5",
    );

    expect(state.primaryId).toBe("planet:moon");
    expect(state.lockedPlaneNormal.z).toBeCloseTo(1);
  });

  it("uses v5 fallback plane when relative velocity is radial", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, 1, 0),
        forward: vec3.create(-1, 0, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.create(2000, 0, 0),
    );
    const state = createCircleNowControllerState();

    updateCircleNowControllerState(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      state,
      "v5",
    );

    expect(state.hasLockedPlane).toBe(true);
    expect(state.lockedPlaneNormal.z).toBeCloseTo(1);
  });

  it("chooses the nearer v5 delta-v line for attitude", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, -1, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.zero(),
    );
    const state = createCircleNowControllerState();
    state.phase = "vectorCircularize";
    state.primaryId = "planet:moon";
    state.hasLockedPlane = true;
    vec3.copyInto(state.lockedPlaneNormal, vec3.create(0, 0, 1));

    const attitude = computeCircleNowAttitudeCommand(
      1000 / 60,
      ship,
      world,
      "v5",
      state,
    );

    expect(attitude).toEqual({ roll: 0, pitch: 0, yaw: 0 });
  });

  it("uses v5 main thrust with the correct nose and tail signs", () => {
    const nose = createWorld(
      {
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.zero(),
    );
    const tail = createWorld(
      {
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, -1, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.zero(),
    );
    const noseState = createCircleNowControllerState();
    const tailState = createCircleNowControllerState();
    for (const state of [noseState, tailState]) {
      state.phase = "vectorCircularize";
      state.primaryId = "planet:moon";
      state.hasLockedPlane = true;
      vec3.copyInto(state.lockedPlaneNormal, vec3.create(0, 0, 1));
    }

    const nosePropulsion = resolveAutopilotPropulsionCommand(
      1000 / 60,
      circleNowInput(),
      nose.ship,
      nose.world,
      zeroPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      "v5",
      noseState,
    );
    const tailPropulsion = resolveAutopilotPropulsionCommand(
      1000 / 60,
      circleNowInput(),
      tail.ship,
      tail.world,
      zeroPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      "v5",
      tailState,
    );

    expect(nosePropulsion.main.forward).toBeGreaterThan(0);
    expect(tailPropulsion.main.forward).toBeLessThan(0);
  });

  it("targets v5 delta-v that cancels radial and tangential speed error", () => {
    const radius = 10_000_000;
    const circularSpeed = Math.sqrt((parameters.newtonG * 7.342e22) / radius);
    const deltaX = -1000;
    const deltaY = circularSpeed - 2000;
    const deltaLen = Math.hypot(deltaX, deltaY);
    const forward = vec3.create(deltaX / deltaLen, deltaY / deltaLen, 0);
    const right = vec3.create(-forward.y, forward.x, 0);
    const { ship, world } = createWorld(
      {
        right,
        forward,
        up: vec3.create(0, 0, 1),
      },
      vec3.create(1000, 2000, 0),
    );
    const state = createCircleNowControllerState();
    state.phase = "vectorCircularize";
    state.primaryId = "planet:moon";
    state.hasLockedPlane = true;
    vec3.copyInto(state.lockedPlaneNormal, vec3.create(0, 0, 1));

    const propulsion = resolveAutopilotPropulsionCommand(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      zeroPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      "v5",
      state,
    );

    expect(propulsion.main.forward).toBeGreaterThan(0);
    expect(propulsion.rcs.right).toBeCloseTo(0);
  });

  it("gates v5 propulsion when the main axis is poorly aligned", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, 1, 0),
        forward: vec3.create(1, 0, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.zero(),
    );
    const state = createCircleNowControllerState();
    state.phase = "vectorCircularize";
    state.primaryId = "planet:moon";
    state.hasLockedPlane = true;
    vec3.copyInto(state.lockedPlaneNormal, vec3.create(0, 0, 1));

    const propulsion = resolveAutopilotPropulsionCommand(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      zeroPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      "v5",
      state,
    );

    expect(propulsion).toEqual(zeroPropulsion);
  });

  it("uses v5 RCS only for residual trim after main projection", () => {
    const angle = (10 * Math.PI) / 180;
    const { ship, world } = createWorld(
      {
        right: vec3.create(-1, 0, 0),
        forward: vec3.create(Math.sin(angle), Math.cos(angle), 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.zero(),
    );
    const state = createCircleNowControllerState();
    state.phase = "vectorCircularize";
    state.primaryId = "planet:moon";
    state.hasLockedPlane = true;
    vec3.copyInto(state.lockedPlaneNormal, vec3.create(0, 0, 1));

    const propulsion = resolveAutopilotPropulsionCommand(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      zeroPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      "v5",
      state,
    );

    expect(propulsion.main.forward).toBeGreaterThan(0);
    expect(propulsion.rcs.right).toBeGreaterThan(0);
  });

  it("hands finished v5 circularization to locked-primary nose alignment only", () => {
    const radius = 10_000_000;
    const circularSpeed = Math.sqrt((parameters.newtonG * 7.342e22) / radius);
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, 0, 1),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(1, 0, 0),
      },
      vec3.create(0, circularSpeed, 0),
    );
    const state = createCircleNowControllerState();
    state.phase = "vectorCircularize";
    state.primaryId = "planet:moon";
    state.hasLockedPlane = true;
    vec3.copyInto(state.lockedPlaneNormal, vec3.create(0, 0, 1));

    const attitude = computeCircleNowAttitudeCommand(
      1000 / 60,
      ship,
      world,
      "v5",
      state,
    );
    const propulsion = resolveAutopilotPropulsionCommand(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      zeroPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      "v5",
      state,
    );

    expect(attitude?.roll).toBe(0);
    expect(
      Math.abs(attitude?.pitch ?? 0) + Math.abs(attitude?.yaw ?? 0),
    ).toBeGreaterThan(0);
    expect(propulsion).toEqual(zeroPropulsion);
  });

  it("keeps v5 finished mode sticky until circle-now is released", () => {
    const radius = 10_000_000;
    const circularSpeed = Math.sqrt((parameters.newtonG * 7.342e22) / radius);
    const { ship, world } = createWorld(
      {
        right: vec3.create(0, 0, 1),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(1, 0, 0),
      },
      vec3.create(0, circularSpeed, 0),
    );
    const state = createCircleNowControllerState();
    state.phase = "vectorCircularize";
    state.primaryId = "planet:moon";
    state.hasLockedPlane = true;
    vec3.copyInto(state.lockedPlaneNormal, vec3.create(0, 0, 1));

    updateCircleNowControllerState(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      state,
      "v5",
    );
    ship.velocity = vec3.create(500, circularSpeed + 500, 0);
    const propulsion = resolveAutopilotPropulsionCommand(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      zeroPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      "v5",
      state,
    );

    expect(state.phase).toBe("vectorFinished");
    expect(propulsion).toEqual(zeroPropulsion);
  });

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

  it("uses v4 main thrust to reduce speed when the tail is closer to velocity", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, -1, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.create(0, 2000, 0),
    );

    const state = createCircleNowControllerState();
    state.phase = "calibrateSpeed";
    state.primaryId = "planet:moon";

    const attitude = computeCircleNowAttitudeCommand(
      1000 / 60,
      ship,
      world,
      "v4",
      state,
    );
    const propulsion = resolveCircleNowPropulsion(
      ship,
      world,
      "calibrateSpeed",
      "v4",
    );

    expect(attitude).toBeNull();
    expect(propulsion.main.forward).toBeGreaterThan(0);
    expect(propulsion.rcs.right).toBe(0);
  });

  it("uses v4 main thrust to reduce speed when the nose is closer to velocity", () => {
    const { ship, world } = createWorld(
      {
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.create(0, 2000, 0),
    );

    const propulsion = resolveCircleNowPropulsion(
      ship,
      world,
      "calibrateSpeed",
      "v4",
    );

    expect(propulsion.main.forward).toBeLessThan(0);
    expect(propulsion.rcs.right).toBe(0);
  });

  it("advances v4 from speed calibration to immediate circularization", () => {
    const moonMass = 7.342e22;
    const radius = 10_000_000;
    const circularSpeed = Math.sqrt((parameters.newtonG * moonMass) / radius);
    const { ship, world } = createWorld(
      {
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(0, 0, 1),
      },
      vec3.create(0, circularSpeed, 0),
    );
    const state = createCircleNowControllerState();
    state.phase = "calibrateSpeed";
    state.primaryId = "planet:moon";

    updateCircleNowControllerState(
      1000 / 60,
      circleNowInput(),
      ship,
      world,
      state,
      "v4",
    );

    expect(state.phase).toBe("circularize");
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
      "v2",
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
