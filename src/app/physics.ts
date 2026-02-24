import type {
  GravityEngine,
  GravityState,
  ShipBody,
} from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type { ControlledBodyState } from "./appInternals.js";
import { maxThrustAcceleration } from "./controls.js";

// Scratch vector for applyThrustToVelocity
const cvScratch = vec3.zero();

/**
 * Apply thrust acceleration to the controlled body's velocity when burn/brake
 * are active. Acceleration magnitude is:
 *
 *   a = maxThrustAcceleration * currentThrustPercent
 */
function applyThrustToVelocity(
  dtMillis: number,
  currentThrustPercent: number,
  body: ControlledBodyState,
): void {
  if (dtMillis === 0 || currentThrustPercent === 0) return;

  const { frame, velocity } = body;
  const accelMagnitude = maxThrustAcceleration * currentThrustPercent;
  vec3.scaleInto(cvScratch, (accelMagnitude * dtMillis) / 1000, frame.forward);
  vec3.addInto(body.velocity, velocity, cvScratch);
}

/**
 * Applies thrust into the ship's body velocity
 */
export function applyThrust(
  dtMillis: number,
  controlledShip: ShipBody,
  currentThrustPercent: number,
): void {
  if (dtMillis === 0) {
    return;
  }

  applyThrustToVelocity(dtMillis, currentThrustPercent, controlledShip);
}

/**
 * Handles orbital physics:
 *  - Maintaining GravityState
 *  - Applying gravity and integrating positions
 */
export function applyGravity(
  dtMillisSim: number,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
): void {
  if (dtMillisSim <= 0) return;

  // Step gravity (updates velocities and positions).
  // if time scale is too high, gravity integration becomes unstable.
  // we mitigate this by splitting the simulated time delta into 5 substeps.
  // this is a trade-off between CPU and stability.
  const stepMillis = dtMillisSim / 5.0;
  let remaining = dtMillisSim;
  for (let i = 0; i < 4; i++) {
    gravityEngine.step(stepMillis / 1000, gravityState);
    remaining -= stepMillis;
  }
  gravityEngine.step(remaining / 1000, gravityState);
}
