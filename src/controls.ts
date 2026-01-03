import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
} from "./controlsConfig.js";
import { mat3, vec } from "./math.js";
import type { Mat3, Plane, Vec3, WorldState } from "./types.js";

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

export interface FlightContext {
  world: WorldState;
  controlledPlaneId: string;
  pilotViewId: string;
}

function findPlane(world: WorldState, id: string): Plane {
  const plane = world.planes.find((p) => p.id === id);
  if (!plane) throw new Error(`Plane not found: ${id}`);
  return plane;
}

function pilotLookAround(
  dtSeconds: number,
  input: ControlInput,
  ctx: FlightContext
): void {
  const pilotView = ctx.world.pilotViews.find((p) => p.id === ctx.pilotViewId);
  if (!pilotView) throw new Error(`Pilot view not found: ${ctx.pilotViewId}`);

  if (input.resetView) {
    pilotView.azimuth = 0;
    pilotView.elevation = 0;
  }

  if (input.lookLeft) pilotView.azimuth += lookSpeed * dtSeconds;
  if (input.lookRight) pilotView.azimuth -= lookSpeed * dtSeconds;
  if (input.lookUp) pilotView.elevation += lookSpeed * dtSeconds;
  if (input.lookDown) pilotView.elevation -= lookSpeed * dtSeconds;
}

export function updatePlaneAxes(statePlane: Plane): void {
  const R = statePlane.orientation;

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

  statePlane.right = right;
  statePlane.forward = forward;
  statePlane.up = up;
}

function roll(
  Rlocal: Mat3 | null,
  dtSeconds: number,
  input: ControlInput,
  plane: Plane
): Mat3 | null {
  if (
    (!input.rollLeft && !input.rollRight) ||
    (input.rollLeft && input.rollRight)
  ) {
    return Rlocal;
  }

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
  plane: Plane
): Mat3 | null {
  let pitchInput = 0;

  if (input.pitchDown) pitchInput += 1;
  if (input.pitchUp) pitchInput -= 1;
  if (pitchInput !== 0) {
    const Rp = mat3.rotAxis(
      plane.right,
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
  plane: Plane
): Mat3 | null {
  if (
    (!input.yawLeft && !input.yawRight) ||
    (input.yawLeft && input.yawRight)
  ) {
    return Rlocal;
  }

  if (input.yawLeft) {
    const Ry = mat3.rotAxis(plane.up, rotSpeedYaw * dtSeconds);
    return Rlocal ? mat3.mul(Ry, Rlocal) : Ry;
  }

  const Ry = mat3.rotAxis(plane.up, -rotSpeedYaw * dtSeconds);
  return Rlocal ? mat3.mul(Ry, Rlocal) : Ry;
}

function moveForward(dtSeconds: number, plane: Plane): void {
  const speed = plane.speed;

  const forward: Vec3 = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };

  plane.position = {
    x: plane.position.x + forward.x * speed * dtSeconds,
    y: plane.position.y + forward.y * speed * dtSeconds,
    z: plane.position.z + forward.z * speed * dtSeconds,
  };
}

// Top-level physics update for a single controlled plane and pilot view.
export function updatePhysics(
  dtSeconds: number,
  input: ControlInput,
  ctx: FlightContext
): void {
  const plane = findPlane(ctx.world, ctx.controlledPlaneId);

  pilotLookAround(dtSeconds, input, ctx);

  let Rlocal = yaw(
    pitch(roll(null, dtSeconds, input, plane), dtSeconds, input, plane),
    dtSeconds,
    input,
    plane
  );

  if (Rlocal) {
    plane.orientation = mat3.mul(Rlocal, plane.orientation);
  }

  updatePlaneAxes(plane);
  moveForward(dtSeconds, plane);
}
