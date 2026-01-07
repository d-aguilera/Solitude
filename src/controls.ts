import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
} from "./controlsConfig.js";
import { mat3, Mat3 } from "./mat3.js";
import type { Plane, Vec3, WorldState } from "./types.js";
import { vec } from "./vec3.js";

// Base thrust acceleration in m/s^2 along plane forward axis
const baseThrustAcceleration = 30; // normal engine thrust

// Multiplier applied when "hyper" is active (huge but still just thrust)
const hyperThrustMultiplier = 1e5; // tweak for feel

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
  burn: boolean; // Space: thrust forward while held
  brake: boolean; // B: thrust opposite to forward to slow down
  hyper: boolean; // H: hyperspace speed toggle
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

/**
 * Apply thrust acceleration to the plane's body velocity when burn is active.
 * Velocity storage lives in the Gravity/BodyState; the gravity step will
 * integrate position from it, so here we only modify velocity.
 */
export function applyThrustToPlaneVelocity(
  dtSeconds: number,
  input: ControlInput,
  planeVelocity: Vec3,
  plane: Plane
): void {
  if (dtSeconds <= 0) return;

  // Determine thrust scalar: +1 for burn (forward), -1 for brake (reverse)
  let thrustSign = 0;

  if (input.burn && !input.brake) thrustSign = 1;
  else if (input.brake && !input.burn) thrustSign = -1;
  else if (input.burn && input.brake) thrustSign = 0; // cancel if both pressed

  if (thrustSign === 0) return;

  const f = plane.forward; // already normalized in updatePlaneAxes

  // Choose acceleration: huge when hyper is held, otherwise normal
  const accelMagnitude =
    input.hyper && thrustSign !== 0
      ? baseThrustAcceleration * hyperThrustMultiplier
      : baseThrustAcceleration;

  const accel = accelMagnitude * thrustSign;

  planeVelocity.x += f.x * accel * dtSeconds;
  planeVelocity.y += f.y * accel * dtSeconds;
  planeVelocity.z += f.z * accel * dtSeconds;
}

// Top-level update for orientation & pilot view; does NOT move the plane
// forward anymore. Position integration is handled by gravity/thrust integration.
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
}
