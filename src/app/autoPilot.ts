import type { World } from "../domain/domainPorts";
import { getDominantBody, getDominantBodyPrimary } from "../domain/orbit";
import { type Vec3, vec3 } from "../domain/vec3";
import { parameters } from "../global/parameters";
import type { AttitudeCommand, ControlledBodyState } from "./appInternals";
import type { PropulsionCommand, RcsCommand, ThrustCommand } from "./controls";

// Max rate at which the ship can reorient itself toward its velocity vector.
const alignToVelocityMaxAngularSpeed = 2.0; // rad/s
// PD gains for alignment (rate command = Kp * angle - Kd * omegaAlongAxis).
const alignToVelocityKp = 4.0;
const alignToVelocityKd = 1.6;

// Scratch vectors
const dominantBodyScratch = vec3.zero();
const velocityScratch: Vec3 = vec3.zero();
const targetForwardScratch: Vec3 = vec3.zero();
const fullAxisScratch: Vec3 = vec3.zero();
const fallbackAxisScratch: Vec3 = vec3.zero();
const axisScratch: Vec3 = vec3.zero();
const tangentialScratch: Vec3 = vec3.zero();
const rScratch: Vec3 = vec3.zero();
const rHatScratch: Vec3 = vec3.zero();
const vRelScratch: Vec3 = vec3.zero();
const rollAxisScratch: Vec3 = vec3.zero();
const rollProjectedScratch: Vec3 = vec3.zero();
const circleRScratch: Vec3 = vec3.zero();
const circleRHatScratch: Vec3 = vec3.zero();
const circleVRelScratch: Vec3 = vec3.zero();
const circleTScratch: Vec3 = vec3.zero();
const circleDeltaVScratch: Vec3 = vec3.zero();
const circleAccelScratch: Vec3 = vec3.zero();
const omegaWorldScratch: Vec3 = vec3.zero();

// Max rate at which the ship can roll to align with a tangential direction.
const alignToTangentMaxAngularSpeed = 1.6; // rad/s
const alignToTangentKp = 3.0;
const alignToTangentKd = 1.0;

const circleZeroThrust: ThrustCommand = { forward: 0 };
const circleZeroRcs: RcsCommand = { right: 0 };
const circleZeroPropulsion: PropulsionCommand = {
  main: circleZeroThrust,
  rcs: circleZeroRcs,
};

export function getDominantBodyDirection(
  { position }: ControlledBodyState,
  world: World,
): Vec3 | null {
  const body = getDominantBody(world, position);
  if (!body) {
    return null;
  }

  vec3.subInto(dominantBodyScratch, body.position, position);
  if (vec3.lengthSq(dominantBodyScratch) === 0) {
    return null;
  }

  return dominantBodyScratch;
}

export function getVelocityDirection({
  velocity,
}: ControlledBodyState): Vec3 | null {
  const speed = vec3.length(velocity);
  if (speed === 0) {
    // No meaningful velocity direction to align to.
    return null;
  }

  // targetForward = v / speed
  vec3.scaleInto(velocityScratch, 1 / speed, velocity);
  return velocityScratch;
}

export function getTangentialDirection(
  ship: ControlledBodyState,
  world: World,
): Vec3 | null {
  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return null;

  vec3.subInto(rScratch, ship.position, primary.body.position);
  const rLen = vec3.length(rScratch);
  if (rLen === 0) return null;
  vec3.scaleInto(rHatScratch, 1 / rLen, rScratch);

  vec3.subInto(vRelScratch, ship.velocity, primary.body.velocity);
  const radialSpeed = vec3.dot(rHatScratch, vRelScratch);
  vec3.scaleInto(tangentialScratch, radialSpeed, rHatScratch);
  vec3.subInto(tangentialScratch, vRelScratch, tangentialScratch);

  const tLen = vec3.length(tangentialScratch);
  if (tLen > 1e-4) {
    vec3.scaleInto(tangentialScratch, 1 / tLen, tangentialScratch);
    return tangentialScratch;
  }

  // Fallback: use ship-right projected onto the orbital plane.
  vec3.copyInto(tangentialScratch, ship.frame.right);
  const proj = vec3.dot(tangentialScratch, rHatScratch);
  vec3.scaleInto(vRelScratch, proj, rHatScratch);
  vec3.subInto(tangentialScratch, tangentialScratch, vRelScratch);
  const projLen = vec3.length(tangentialScratch);
  if (projLen <= 1e-4) return null;

  vec3.scaleInto(tangentialScratch, 1 / projLen, tangentialScratch);
  return tangentialScratch;
}

/**
 * Roll-only alignment: command a roll rate so the ship's right axis aligns with
 * the target direction projected onto the roll plane.
 */
export function computeRollToDirectionCommand(
  dtMillis: number,
  state: ControlledBodyState,
  targetDirection: Vec3,
): AttitudeCommand | null {
  const len = vec3.length(targetDirection);
  if (len === 0) return null;

  if (dtMillis <= 0) return null;

  const forward = state.frame.forward;

  vec3.scaleInto(rollProjectedScratch, 1 / len, targetDirection);
  const proj = vec3.dot(rollProjectedScratch, forward);
  vec3.scaleInto(rollAxisScratch, proj, forward);
  vec3.subInto(rollProjectedScratch, rollProjectedScratch, rollAxisScratch);

  const projLen = vec3.length(rollProjectedScratch);
  if (projLen < 1e-6) return null;
  vec3.scaleInto(rollProjectedScratch, 1 / projLen, rollProjectedScratch);

  const currentRight = state.frame.right;
  const dot = vec3.dot(currentRight, rollProjectedScratch);
  const clampedDot = clamp(dot, -1, 1);
  const angle = Math.acos(clampedDot);
  if (angle < 1e-4) return null;

  vec3.crossInto(rollAxisScratch, currentRight, rollProjectedScratch);
  const sign = vec3.dot(rollAxisScratch, forward) >= 0 ? 1 : -1;
  const signedAngle = angle * sign;
  const omegaRoll = state.angularVelocity.roll;
  const rawSpeed =
    alignToTangentKp * signedAngle - alignToTangentKd * omegaRoll;
  const speed = clamp(
    rawSpeed,
    -alignToTangentMaxAngularSpeed,
    alignToTangentMaxAngularSpeed,
  );
  return { roll: speed, pitch: 0, yaw: 0 };
}

export function computeCircleNowAttitudeCommand(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
): AttitudeCommand | null {
  let command: AttitudeCommand | null = null;

  const inward = getDominantBodyDirection(ship, world);
  if (inward) {
    command = computeAlignToDirectionCommand(dtMillis, ship, inward);
  }

  const tangential = getTangentialDirection(ship, world);
  if (tangential) {
    const rollCommand = computeRollToDirectionCommand(
      dtMillis,
      ship,
      tangential,
    );
    if (rollCommand) {
      command = command
        ? {
            roll: command.roll + rollCommand.roll,
            pitch: command.pitch,
            yaw: command.yaw,
          }
        : rollCommand;
    }
  }

  return command;
}

function commandFromWorldAxis(
  state: ControlledBodyState,
  axisWorld: Vec3,
  speed: number,
): AttitudeCommand {
  const { forward, right, up } = state.frame;
  return {
    roll: vec3.dot(axisWorld, forward) * speed,
    pitch: vec3.dot(axisWorld, right) * speed,
    yaw: vec3.dot(axisWorld, up) * speed,
  };
}

/**
 * Compute an attitude command that aligns the body's forward axis with the
 * specified target direction, rate-limited by {@link alignToVelocityMaxAngularSpeed}.
 */
export function computeAlignToDirectionCommand(
  dtMillis: number,
  state: ControlledBodyState,
  targetDirection: Vec3,
): AttitudeCommand | null {
  if (dtMillis === 0) return null;

  const len = vec3.length(targetDirection);
  if (len === 0) return null;

  vec3.scaleInto(targetForwardScratch, 1 / len, targetDirection);
  const targetForward = targetForwardScratch;
  const currentForward = state.frame.forward;

  // If we're already nearly aligned, do nothing.
  const dot = vec3.dot(currentForward, targetForward);
  const clampedDot = clamp(dot, -1, 1);
  const angle = Math.acos(clampedDot);
  if (angle < 1e-4) {
    return null;
  }

  // fullAxis = currentForward × targetForward
  vec3.crossInto(fullAxisScratch, currentForward, targetForward);
  const axisLen = vec3.length(fullAxisScratch);

  if (axisLen < 1e-6) {
    // Parallel or anti-parallel: choose an arbitrary axis orthogonal to forward.
    if (clampedDot > 0) {
      return null;
    }
    const up = state.frame.up;
    vec3.crossInto(fallbackAxisScratch, currentForward, up);
    const fallbackLen = vec3.length(fallbackAxisScratch);
    if (fallbackLen < 1e-6) {
      vec3.copyInto(axisScratch, state.frame.right);
    } else {
      vec3.scaleInto(axisScratch, 1 / fallbackLen, fallbackAxisScratch);
    }
  } else {
    vec3.scaleInto(axisScratch, 1 / axisLen, fullAxisScratch);
  }

  const omega = state.angularVelocity;
  vec3.scaleInto(omegaWorldScratch, omega.roll, state.frame.forward);
  vec3.scaleInto(fullAxisScratch, omega.pitch, state.frame.right);
  vec3.addInto(omegaWorldScratch, omegaWorldScratch, fullAxisScratch);
  vec3.scaleInto(fullAxisScratch, omega.yaw, state.frame.up);
  vec3.addInto(omegaWorldScratch, omegaWorldScratch, fullAxisScratch);

  const omegaAlongAxis = vec3.dot(omegaWorldScratch, axisScratch);
  const rawSpeed =
    alignToVelocityKp * angle - alignToVelocityKd * omegaAlongAxis;
  const speed = clamp(
    rawSpeed,
    -alignToVelocityMaxAngularSpeed,
    alignToVelocityMaxAngularSpeed,
  );
  return commandFromWorldAxis(state, axisScratch, speed);
}

export function computeCircleNowThrust(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  maxThrustAcceleration: number,
  maxRcsTranslationAcceleration: number,
): PropulsionCommand {
  if (maxThrustAcceleration === 0) {
    return circleZeroPropulsion;
  }
  const dtSec = dtMillis / 1000;
  if (dtSec === 0) return circleZeroPropulsion;

  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return circleZeroPropulsion;

  vec3.subInto(circleRScratch, ship.position, primary.body.position);
  const r2 = vec3.lengthSq(circleRScratch);
  if (r2 === 0) return circleZeroPropulsion;
  const r = Math.sqrt(r2);
  vec3.scaleInto(circleRHatScratch, 1 / r, circleRScratch);

  vec3.subInto(circleVRelScratch, ship.velocity, primary.body.velocity);
  const radialSpeed = vec3.dot(circleRHatScratch, circleVRelScratch);

  vec3.scaleInto(circleTScratch, radialSpeed, circleRHatScratch);
  vec3.subInto(circleTScratch, circleVRelScratch, circleTScratch);
  const tangentialSpeed = vec3.length(circleTScratch);
  let hasTangentialDir = false;
  if (tangentialSpeed > 1e-6) {
    vec3.scaleInto(circleTScratch, 1 / tangentialSpeed, circleTScratch);
    hasTangentialDir = true;
  } else {
    vec3.copyInto(circleTScratch, ship.frame.right);
    const proj = vec3.dot(circleTScratch, circleRHatScratch);
    vec3.scaleInto(circleVRelScratch, proj, circleRHatScratch);
    vec3.subInto(circleTScratch, circleTScratch, circleVRelScratch);
    const projLen = vec3.length(circleTScratch);
    if (projLen > 1e-6) {
      vec3.scaleInto(circleTScratch, 1 / projLen, circleTScratch);
      hasTangentialDir = true;
    }
  }

  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return circleZeroPropulsion;

  const circularSpeed = Math.sqrt(mu / r);
  const deltaVRadial = -radialSpeed;
  const deltaVTangential = circularSpeed - tangentialSpeed;

  vec3.scaleInto(circleDeltaVScratch, deltaVRadial, circleRHatScratch);

  if (hasTangentialDir) {
    vec3.scaleInto(circleAccelScratch, deltaVTangential, circleTScratch);
    vec3.addInto(circleDeltaVScratch, circleDeltaVScratch, circleAccelScratch);
  }

  const deltaVMag = vec3.length(circleDeltaVScratch);
  if (deltaVMag < 1e-9) return circleZeroPropulsion;

  const maxDeltaV = maxThrustAcceleration * dtSec;
  if (maxDeltaV <= 0) return circleZeroPropulsion;

  let scale = 1;
  if (deltaVMag > maxDeltaV) {
    scale = maxDeltaV / deltaVMag;
  }
  vec3.scaleInto(circleAccelScratch, scale / dtSec, circleDeltaVScratch);

  const forwardCmd =
    vec3.dot(circleAccelScratch, ship.frame.forward) / maxThrustAcceleration;

  const rightCmd =
    maxRcsTranslationAcceleration > 0
      ? vec3.dot(circleAccelScratch, ship.frame.right) /
        maxRcsTranslationAcceleration
      : 0;

  return {
    main: {
      forward: clamp(forwardCmd, -1, 1),
    },
    rcs: {
      right: clamp(rightCmd, -1, 1),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
