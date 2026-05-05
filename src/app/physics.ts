import type {
  EntityAxialSpin,
  GravityEngine,
  GravityState,
  World,
} from "../domain/domainPorts";
import { localFrame } from "../domain/localFrame";
import { mat3 } from "../domain/mat3";
import { vec3 } from "../domain/vec3";
import type { ControlledBodyState } from "./controlPorts";

const Rspin = mat3.zero();
const omegaWorldScratch = vec3.zero();
const omegaAxisScratch = vec3.zero();

/**
 * Integrate controlled-body attitude by applying angular velocity to the local frame.
 */
export function applyControlledBodyRotation(
  dtMillis: number,
  controlledBody: ControlledBodyState,
): void {
  const dtSec = dtMillis / 1000;
  if (dtSec <= 0) return;

  const omega = controlledBody.angularVelocity;
  if (omega.roll === 0 && omega.pitch === 0 && omega.yaw === 0) return;

  const { frame } = controlledBody;
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
  localFrame.intoMat3(controlledBody.orientation, frame);
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

function applySpinForBodies(
  dtMillisSim: number,
  bodies: EntityAxialSpin[],
): void {
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    const angle = (body.angularSpeedRadPerSec * dtMillisSim) / 1000;
    if (angle === 0) continue;
    mat3.rotAxisInto(Rspin, body.rotationAxis, angle);
    mat3.mulMat3Into(body.state.orientation, Rspin, body.state.orientation);
  }
}

/**
 * Advance axial spin for entities that expose the axial-spin capability.
 */
export function applyAxialSpin(dtMillisSim: number, world: World): void {
  if (dtMillisSim <= 0) return;

  applySpinForBodies(dtMillisSim, world.axialSpins);
}
