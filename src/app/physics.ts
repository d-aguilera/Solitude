import type {
  GravityEngine,
  GravityState,
  RotatingBody,
  ShipBody,
  World,
} from "../domain/domainPorts";
import { localFrame } from "../domain/localFrame";
import { mat3 } from "../domain/mat3";
import { vec3 } from "../domain/vec3";
import type {
  ControlledBodyState,
  RcsCommand,
  ThrustCommand,
} from "./controlPorts";
import {
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
} from "./controls";

// Scratch vector for applyThrustToVelocity
const cvScratch = vec3.zero();
const Rspin = mat3.zero();
const omegaWorldScratch = vec3.zero();
const omegaAxisScratch = vec3.zero();

/**
 * Apply thrust acceleration to the controlled body's velocity when burn/brake
 * are active. Acceleration magnitude is:
 *
 *   a = maxThrustAcceleration * currentThrustPercent
 */
function applyThrustToVelocity(
  dtMillis: number,
  thrust: ThrustCommand,
  body: ControlledBodyState,
): void {
  if (dtMillis === 0) return;
  if (thrust.forward === 0) return;

  const { frame, velocity } = body;
  const accelScale = (maxThrustAcceleration * dtMillis) / 1000;

  if (thrust.forward !== 0) {
    vec3.scaleInto(cvScratch, accelScale * thrust.forward, frame.forward);
    vec3.addInto(body.velocity, velocity, cvScratch);
  }
}

/**
 * Applies thrust into the ship's body velocity
 */
export function applyThrust(
  dtMillis: number,
  controlledShip: ShipBody,
  thrust: ThrustCommand,
): void {
  if (dtMillis === 0) {
    return;
  }

  applyThrustToVelocity(dtMillis, thrust, controlledShip);
}

/**
 * Applies RCS translation jets into the ship's body velocity (lateral only).
 */
export function applyRcsTranslation(
  dtMillis: number,
  controlledShip: ShipBody,
  rcs: RcsCommand,
): void {
  if (dtMillis === 0) {
    return;
  }
  if (rcs.right === 0) return;

  const accelScale = (maxRcsTranslationAcceleration * dtMillis) / 1000;
  vec3.scaleInto(cvScratch, accelScale * rcs.right, controlledShip.frame.right);
  vec3.addInto(controlledShip.velocity, controlledShip.velocity, cvScratch);
}

/**
 * Integrate ship attitude by applying its angular velocity to the local frame.
 */
export function applyShipRotation(
  dtMillis: number,
  ship: ControlledBodyState,
): void {
  const dtSec = dtMillis / 1000;
  if (dtSec <= 0) return;

  const omega = ship.angularVelocity;
  if (omega.roll === 0 && omega.pitch === 0 && omega.yaw === 0) return;

  const { frame } = ship;
  // Convert roll/pitch/yaw rates into a world-space angular velocity vector.
  omegaWorldScratch.x =
    frame.forward.x * omega.roll +
    frame.right.x * omega.pitch +
    frame.up.x * omega.yaw;
  omegaWorldScratch.y =
    frame.forward.y * omega.roll +
    frame.right.y * omega.pitch +
    frame.up.y * omega.yaw;
  omegaWorldScratch.z =
    frame.forward.z * omega.roll +
    frame.right.z * omega.pitch +
    frame.up.z * omega.yaw;

  const omegaMag = vec3.length(omegaWorldScratch);
  if (omegaMag === 0) return;

  const angle = omegaMag * dtSec;
  vec3.scaleInto(omegaAxisScratch, 1 / omegaMag, omegaWorldScratch);
  localFrame.rotateAroundAxisInPlace(frame, omegaAxisScratch, angle);
  localFrame.intoMat3(ship.orientation, frame);
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

function applySpinForBodies(dtMillisSim: number, bodies: RotatingBody[]): void {
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    const angle = (body.angularSpeedRadPerSec * dtMillisSim) / 1000;
    if (angle === 0) continue;
    mat3.rotAxisInto(Rspin, body.rotationAxis, angle);
    mat3.mulMat3Into(body.orientation, Rspin, body.orientation);
  }
}

/**
 * Advance axial spin for planets and stars as a simulation concern.
 */
export function applyCelestialSpin(dtMillisSim: number, world: World): void {
  if (dtMillisSim <= 0) return;

  applySpinForBodies(dtMillisSim, world.planets);
  applySpinForBodies(dtMillisSim, world.stars);
}
