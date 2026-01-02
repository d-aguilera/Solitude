import { mat3, vec } from "./math.js";
import { PLANET_RADIUS, planetCenter } from "./planet.js";
import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
} from "./setup.js";
import type { Mat3, Plane, SceneObject, Vec3 } from "./types.js";

export interface ControlInput {
  rollLeft: boolean;
  rollRight: boolean;
  pitchUp: boolean;
  pitchDown: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  lookLeft: boolean;
  lookRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
  resetView: boolean;
  pause: boolean;
  toggleProfiling: boolean;
}

// Encapsulate the state that physics operates on rather than reaching into globals
export interface FlightState {
  plane: Plane;
  pilot: {
    azimuth: number;
    elevation: number;
  };
  mainAirplane: SceneObject;
}

/**
 * Pure-ish physics step: consumes current state and input, mutates the provided state object.
 * This avoids direct dependence on the global singletons in setup.ts, reducing coupling.
 */
export function updatePhysics(
  dtSeconds: number,
  input: ControlInput,
  state: FlightState
): void {
  pilotLookAround(dtSeconds, input, state);

  let Rlocal = yaw(
    pitch(roll(null, dtSeconds, input, state), dtSeconds, input, state),
    dtSeconds,
    input,
    state
  );

  if (Rlocal) {
    state.plane.orientation = mat3.mul(Rlocal, state.plane.orientation);
  }

  updatePlaneAxesSpherical(state);

  moveForwardSpherical(dtSeconds, state);

  const mainAirplane = state.mainAirplane;
  const plane = state.plane;
  mainAirplane.x = plane.x;
  mainAirplane.y = plane.y;
  mainAirplane.z = plane.z;
  mainAirplane.orientation = plane.orientation;
  mainAirplane.scale = plane.scale;
}

function pilotLookAround(
  dtSeconds: number,
  input: ControlInput,
  state: FlightState
): void {
  const pilot = state.pilot;

  if (input.resetView) {
    pilot.azimuth = 0;
    pilot.elevation = 0;
  }

  if (input.lookLeft) pilot.azimuth += lookSpeed * dtSeconds;
  if (input.lookRight) pilot.azimuth -= lookSpeed * dtSeconds;
  if (input.lookUp) pilot.elevation += lookSpeed * dtSeconds;
  if (input.lookDown) pilot.elevation -= lookSpeed * dtSeconds;
}

export function updatePlaneAxesSpherical(state: FlightState): void {
  const R = state.plane.orientation;

  let right: Vec3 = { x: R[0][0], y: R[1][0], z: R[2][0] };
  let forward: Vec3 = { x: R[0][1], y: R[1][1], z: R[2][1] };
  let up: Vec3 = { x: R[0][2], y: R[1][2], z: R[2][2] };

  const lenRight = vec.length(right) || 1;
  right = {
    x: right.x / lenRight,
    y: right.y / lenRight,
    z: right.z / lenRight,
  };

  const lenForward = vec.length(forward) || 1;
  forward = {
    x: forward.x / lenForward,
    y: forward.y / lenForward,
    z: forward.z / lenForward,
  };

  const lenUp = vec.length(up) || 1;
  up = { x: up.x / lenUp, y: up.y / lenUp, z: up.z / lenUp };

  state.plane.right = right;
  state.plane.forward = forward;
  state.plane.up = up;
}

function roll(
  Rlocal: Mat3 | null,
  dtSeconds: number,
  input: ControlInput,
  state: FlightState
): Mat3 | null {
  if (
    (!input.rollLeft && !input.rollRight) ||
    (input.rollLeft && input.rollRight)
  ) {
    return Rlocal;
  }

  const plane = state.plane;

  if (input.rollLeft) {
    const Rr = mat3.rotAxis(plane.forward, -rotSpeedRoll * dtSeconds);
    return Rlocal ? mat3.mul(Rr, Rlocal) : Rr;
  }

  const Rr = mat3.rotAxis(plane.forward, rotSpeedRoll * dtSeconds);
  return Rlocal ? mat3.mul(Rr, Rlocal) : Rr;
}

function pitch(
  Rlocal: Mat3 | null,
  dtSeconds: number,
  input: ControlInput,
  state: FlightState
): Mat3 | null {
  let pitchInput = 0;

  if (input.pitchDown) pitchInput += 1;
  if (input.pitchUp) pitchInput -= 1;
  if (pitchInput !== 0) {
    const Rp = mat3.rotAxis(
      state.plane.right,
      pitchInput * rotSpeedPitch * dtSeconds
    );
    Rlocal = Rlocal ? mat3.mul(Rp, Rlocal) : Rp;
  }
  return Rlocal;
}

function yaw(
  Rlocal: Mat3 | null,
  dtSeconds: number,
  input: ControlInput,
  state: FlightState
): Mat3 | null {
  if (
    (!input.yawLeft && !input.yawRight) ||
    (input.yawLeft && input.yawRight)
  ) {
    return Rlocal;
  }

  const plane = state.plane;

  if (input.yawLeft) {
    const Ry = mat3.rotAxis(plane.up, rotSpeedYaw * dtSeconds);
    return Rlocal ? mat3.mul(Ry, Rlocal) : Ry;
  }

  const Ry = mat3.rotAxis(plane.up, -rotSpeedYaw * dtSeconds);
  return Rlocal ? mat3.mul(Ry, Rlocal) : Ry;
}

function moveForwardSpherical(dtSeconds: number, state: FlightState): void {
  const plane = state.plane;
  const speed = plane.speed;

  const forward: Vec3 = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };

  let newX = plane.x + forward.x * speed * dtSeconds;
  let newY = plane.y + forward.y * speed * dtSeconds;
  let newZ = plane.z + forward.z * speed * dtSeconds;

  const fromCenter = vec.sub({ x: newX, y: newY, z: newZ }, planetCenter);
  const len = vec.length(fromCenter);

  if (len < PLANET_RADIUS + 1) {
    const scale = (PLANET_RADIUS + 1) / len;
    newX = planetCenter.x + fromCenter.x * scale;
    newY = planetCenter.y + fromCenter.y * scale;
    newZ = planetCenter.z + fromCenter.z * scale;
  }

  plane.x = newX;
  plane.y = newY;
  plane.z = newZ;
}
