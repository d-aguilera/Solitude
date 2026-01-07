import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
} from "./controlsConfig.js";
import { rotateFrameAroundAxis } from "../../world/localFrame.js";
import type { LocalFrame, Plane, Vec3, WorldState } from "../../world/types.js";
import { getPlaneById } from "../../world/worldLookup.js";

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

function rollFrame(
  frame: LocalFrame,
  dtSeconds: number,
  input: ControlInput
): LocalFrame {
  if (
    (!input.rollLeft && !input.rollRight) ||
    (input.rollLeft && input.rollRight)
  ) {
    return frame;
  }

  const angle = (input.rollLeft ? -1 : 1) * rotSpeedRoll * dtSeconds;

  // Roll around local forward axis (in world coords)
  return rotateFrameAroundAxis(frame, frame.forward, angle);
}

function pitchFrame(
  frame: LocalFrame,
  dtSeconds: number,
  input: ControlInput
): LocalFrame {
  let pitchInput = 0;
  if (input.pitchDown) pitchInput += 1;
  if (input.pitchUp) pitchInput -= 1;
  if (pitchInput === 0) return frame;

  const angle = pitchInput * rotSpeedPitch * dtSeconds;

  // Pitch around local right axis
  return rotateFrameAroundAxis(frame, frame.right, angle);
}

function yawFrame(
  frame: LocalFrame,
  dtSeconds: number,
  input: ControlInput
): LocalFrame {
  if (
    (!input.yawLeft && !input.yawRight) ||
    (input.yawLeft && input.yawRight)
  ) {
    return frame;
  }

  const angle = (input.yawLeft ? 1 : -1) * rotSpeedYaw * dtSeconds;

  // Yaw around local up axis
  return rotateFrameAroundAxis(frame, frame.up, angle);
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

  let thrustSign = 0;
  if (input.burn && !input.brake) thrustSign = 1;
  else if (input.brake && !input.burn) thrustSign = -1;

  if (thrustSign === 0) return;

  const f = plane.frame.forward; // LocalFrame forward

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
  const plane = getPlaneById(ctx.world, ctx.controlledPlaneId);

  pilotLookAround(dtSeconds, input, ctx);

  let frame = plane.frame;
  frame = rollFrame(frame, dtSeconds, input);
  frame = pitchFrame(frame, dtSeconds, input);
  frame = yawFrame(frame, dtSeconds, input);

  plane.frame = frame; // orientation is now fully expressed by LocalFrame
}
