import type {
  AttitudeCommand,
  ControlInput,
  ControlledBodyState,
} from "../../app/controlPorts";
import type {
  PropulsionCommand,
  RcsCommand,
  ThrustCommand,
} from "../../app/controls";
import type { World } from "../../domain/domainPorts";
import {
  EPS_ANGLE_RAD,
  EPS_DELTA_V,
  EPS_LEN,
  EPS_LEN_COARSE,
  EPS_SPEED_COARSE,
  EPS_SPEED_FINE,
} from "../../domain/epsilon";
import { getDominantBody, getDominantBodyPrimary } from "../../domain/orbit";
import { vec3, type Vec3 } from "../../domain/vec3";
import { parameters } from "../../global/parameters";
import {
  defaultAutopilotAlgorithmVersion,
  type AutopilotAlgorithmVersion,
} from "./version";

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
const circleProjScratch: Vec3 = vec3.zero();
const circleResidualScratch: Vec3 = vec3.zero();
const circleTargetVelocityScratch: Vec3 = vec3.zero();
const circleTargetDirectionScratch: Vec3 = vec3.zero();

type DominantPrimary = NonNullable<ReturnType<typeof getDominantBodyPrimary>>;
type CircleNowState = {
  r: number;
  radialSpeed: number;
  tangentialSpeed: number;
  hasTangentialDir: boolean;
};
const circleStateScratch: CircleNowState = {
  r: 0,
  radialSpeed: 0,
  tangentialSpeed: 0,
  hasTangentialDir: false,
};

// Max rate at which the ship can roll to align with a tangential direction.
const alignToTangentMaxAngularSpeed = 1.6; // rad/s
const alignToTangentKp = 3.0;
const alignToTangentKd = 1.0;

const circleNowNoseAlignedDeg = 8;
const circleNowNoseFallbackAlignedDeg = 15;
const circleNowRadialBrakingAlignedDeg = 20;
const circleNowSpeedCalibrationAlignedDeg = 20;
const circleNowSpeedCalibrationToleranceMps = 5;
const circleNowVectorAlignedDeg = 20;
const circleNowVectorFullAuthorityDeg = 8;
const circleNowVectorDoneDeltaVMps = 0.05;
const circleNowNosePitchYawRateMax = 0.3; // rad/s
const circleNowNoseFallbackMs = 1500;
const circleNowRollAlignedDeg = 30;
const circleNowRollGoodEnoughDeg = 60;
const circleNowPlaneGoodEnoughScore = 0.35;
const circleNowPlaneTimeoutScore = 0.25;
const circleNowPlaneTimeoutMs = 2500;
const circleNowPropulsionMinScore = 0.25;
const circleNowPropulsionFullScore = 0.5;
const circleNowMinorRollDeg = 15;
const circleNowFullRollDeg = 45;
const RAD_TO_DEG = 180 / Math.PI;

const circleZeroThrust: ThrustCommand = { forward: 0 };
const circleZeroRcs: RcsCommand = { right: 0 };
const circleZeroPropulsion: PropulsionCommand = {
  main: circleZeroThrust,
  rcs: circleZeroRcs,
};

export type CircleNowPhase =
  | "calibrateSpeed"
  | "acquireNose"
  | "acquirePlane"
  | "circularize"
  | "vectorCircularize"
  | "vectorFinished";

export interface CircleNowControllerState {
  phase: CircleNowPhase;
  phaseElapsedMs: number;
  primaryId: string | null;
  hasLockedPlane: boolean;
  lockedPlaneNormal: Vec3;
}

interface CircleNowGuidance {
  actuatorPlaneScore: number;
  circularSpeed: number;
  inwardAlignmentDeg: number;
  primaryId: string;
  tangentialRollAlignmentDeg: number;
}

const circleGuidanceScratch: CircleNowGuidance = {
  actuatorPlaneScore: NaN,
  circularSpeed: NaN,
  inwardAlignmentDeg: NaN,
  primaryId: "",
  tangentialRollAlignmentDeg: NaN,
};

export function createCircleNowControllerState(): CircleNowControllerState {
  return {
    phase: "acquireNose",
    phaseElapsedMs: 0,
    primaryId: null,
    hasLockedPlane: false,
    lockedPlaneNormal: vec3.zero(),
  };
}

export function resetCircleNowControllerState(
  state: CircleNowControllerState,
): void {
  state.phase = "acquireNose";
  state.phaseElapsedMs = 0;
  state.primaryId = null;
  state.hasLockedPlane = false;
  state.lockedPlaneNormal.x = 0;
  state.lockedPlaneNormal.y = 0;
  state.lockedPlaneNormal.z = 0;
}

export function getDominantBodyDirection(
  state: ControlledBodyState,
  world: World,
): Vec3 | null {
  const position = state.position;
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

export function getVelocityDirection(state: ControlledBodyState): Vec3 | null {
  const velocity = state.velocity;
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
  if (tLen > EPS_SPEED_COARSE) {
    vec3.scaleInto(tangentialScratch, 1 / tLen, tangentialScratch);
    return tangentialScratch;
  }

  // Fallback: use ship-right projected onto the orbital plane.
  vec3.copyInto(tangentialScratch, ship.frame.right);
  const proj = vec3.dot(tangentialScratch, rHatScratch);
  vec3.scaleInto(vRelScratch, proj, rHatScratch);
  vec3.subInto(tangentialScratch, tangentialScratch, vRelScratch);
  const projLen = vec3.length(tangentialScratch);
  if (projLen <= EPS_LEN_COARSE) return null;

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
  if (projLen < EPS_LEN) return null;
  vec3.scaleInto(rollProjectedScratch, 1 / projLen, rollProjectedScratch);

  const currentRight = state.frame.right;
  const dot = vec3.dot(currentRight, rollProjectedScratch);
  const clampedDot = clamp(dot, -1, 1);
  const angle = Math.acos(clampedDot);
  if (angle < EPS_ANGLE_RAD) return null;

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
  algorithmVersion: AutopilotAlgorithmVersion = defaultAutopilotAlgorithmVersion,
  controllerState?: CircleNowControllerState,
): AttitudeCommand | null {
  const phase = usesCircleNowControllerState(algorithmVersion)
    ? (controllerState?.phase ?? getInitialCircleNowPhase(algorithmVersion))
    : "circularize";

  if (algorithmVersion === "v5") {
    return computeCircleNowVectorAttitudeCommand(
      dtMillis,
      ship,
      world,
      controllerState,
    );
  }

  if (phase === "calibrateSpeed") {
    const velocityLineDirection = getClosestVelocityLineDirection(ship);
    return velocityLineDirection
      ? computeAlignToDirectionCommand(dtMillis, ship, velocityLineDirection)
      : null;
  }

  const inward = getDominantBodyDirection(ship, world);
  let command: AttitudeCommand | null = null;
  if (inward) {
    command = computeAlignToDirectionCommand(dtMillis, ship, inward);
  }

  if (phase === "acquireNose") {
    return {
      roll: 0,
      pitch: command?.pitch ?? 0,
      yaw: command?.yaw ?? 0,
    };
  }

  const tangential = getTangentialDirection(ship, world);
  if (tangential) {
    const rollScale =
      phase === "circularize" && usesCircleNowPropulsionGating(algorithmVersion)
        ? getCircleNowRollCorrectionScale(ship, tangential)
        : 1;
    const rollCommand =
      rollScale > 0
        ? computeRollToDirectionCommand(dtMillis, ship, tangential)
        : null;
    if (rollCommand) {
      command = command
        ? {
            roll: command.roll + rollCommand.roll * rollScale,
            pitch: command.pitch,
            yaw: command.yaw,
          }
        : rollCommand;
    }
  }

  return command;
}

export function updateCircleNowControllerState(
  dtMillis: number,
  controlInput: ControlInput,
  ship: ControlledBodyState,
  world: World,
  state: CircleNowControllerState,
  algorithmVersion: AutopilotAlgorithmVersion = defaultAutopilotAlgorithmVersion,
): void {
  if (!controlInput.circleNow) {
    resetCircleNowControllerState(state);
    return;
  }

  if (algorithmVersion === "v5") {
    updateCircleNowVectorControllerState(ship, world, state);
    if (!state.primaryId || !state.hasLockedPlane) {
      return;
    }
    if (state.phase === "vectorCircularize") {
      const guidance = computeCircleNowVectorGuidance(ship, world, state);
      if (
        guidance?.deltaVMag != null &&
        guidance.deltaVMag <= circleNowVectorDoneDeltaVMps
      ) {
        state.phase = "vectorFinished";
        state.phaseElapsedMs = 0;
      }
    }
    state.phaseElapsedMs += Math.max(0, dtMillis);
    return;
  }

  const guidance = computeCircleNowGuidance(ship, world);
  if (!guidance) {
    resetCircleNowControllerState(state);
    return;
  }

  if (state.primaryId !== guidance.primaryId) {
    state.phase = getInitialCircleNowPhase(algorithmVersion);
    state.phaseElapsedMs = 0;
    state.primaryId = guidance.primaryId;
  }

  state.phaseElapsedMs += Math.max(0, dtMillis);

  if (state.phase === "calibrateSpeed") {
    if (isCircleNowSpeedCalibrated(ship, guidance)) {
      state.phase = "circularize";
      state.phaseElapsedMs = 0;
    }
    return;
  }

  if (state.phase === "acquireNose") {
    if (isCircleNowNoseAcquired(ship, guidance, state.phaseElapsedMs)) {
      state.phase = "acquirePlane";
      state.phaseElapsedMs = 0;
    }
    return;
  }

  if (state.phase === "acquirePlane") {
    if (isCircleNowPlaneAcquired(guidance, state.phaseElapsedMs)) {
      state.phase = "circularize";
      state.phaseElapsedMs = 0;
    }
  }
}

export function getAutopilotAttitudeCommand(
  dtMillis: number,
  ship: ControlledBodyState,
  controlInput: ControlInput,
  world: World,
  algorithmVersion: AutopilotAlgorithmVersion = defaultAutopilotAlgorithmVersion,
  controllerState?: CircleNowControllerState,
): AttitudeCommand | null {
  if (controlInput.circleNow) {
    return computeCircleNowAttitudeCommand(
      dtMillis,
      ship,
      world,
      algorithmVersion,
      controllerState,
    );
  }

  if (controlInput.alignToBody) {
    const direction = getDominantBodyDirection(ship, world);
    if (direction) {
      return computeAlignToDirectionCommand(dtMillis, ship, direction);
    }
  } else if (controlInput.alignToVelocity) {
    const direction = getVelocityDirection(ship);
    if (direction) {
      return computeAlignToDirectionCommand(dtMillis, ship, direction);
    }
  }

  return null;
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
  if (angle < EPS_ANGLE_RAD) {
    return null;
  }

  // fullAxis = currentForward × targetForward
  vec3.crossInto(fullAxisScratch, currentForward, targetForward);
  const axisLen = vec3.length(fullAxisScratch);

  if (axisLen < EPS_LEN) {
    // Parallel or anti-parallel: choose an arbitrary axis orthogonal to forward.
    if (clampedDot > 0) {
      return null;
    }
    const up = state.frame.up;
    vec3.crossInto(fallbackAxisScratch, currentForward, up);
    const fallbackLen = vec3.length(fallbackAxisScratch);
    if (fallbackLen < EPS_LEN) {
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

function computeCircleNowGuidance(
  ship: ControlledBodyState,
  world: World,
): CircleNowGuidance | null {
  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return null;

  const state = computeCircleNowState(ship, primary);
  if (!state) return null;

  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return null;

  const circularSpeed = Math.sqrt(mu / state.r);
  const deltaVMag = computeCircleDeltaV(
    state.radialSpeed,
    state.tangentialSpeed,
    state.hasTangentialDir,
    circularSpeed,
    circleRHatScratch,
    circleTScratch,
    circleDeltaVScratch,
  );

  circleGuidanceScratch.primaryId = primary.id;
  circleGuidanceScratch.circularSpeed = circularSpeed;
  circleGuidanceScratch.inwardAlignmentDeg = computeInwardAlignmentDeg(ship);
  circleGuidanceScratch.tangentialRollAlignmentDeg = state.hasTangentialDir
    ? computeRollAlignmentDeg(ship, circleTScratch)
    : NaN;
  circleGuidanceScratch.actuatorPlaneScore =
    deltaVMag >= EPS_DELTA_V
      ? computeActuatorPlaneScore(ship, circleDeltaVScratch, deltaVMag)
      : 1;
  return circleGuidanceScratch;
}

interface CircleNowVectorGuidance {
  deltaVMag: number;
}

const circleVectorGuidanceScratch: CircleNowVectorGuidance = {
  deltaVMag: 0,
};

function updateCircleNowVectorControllerState(
  ship: ControlledBodyState,
  world: World,
  state: CircleNowControllerState,
): void {
  if (state.primaryId && state.hasLockedPlane) {
    if (findDominantPrimaryById(world, state.primaryId)) {
      return;
    }
    resetCircleNowControllerState(state);
    return;
  }

  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) {
    resetCircleNowControllerState(state);
    return;
  }

  if (!computeCircleNowLockedPlane(ship, primary, state.lockedPlaneNormal)) {
    resetCircleNowControllerState(state);
    return;
  }

  state.phase = "vectorCircularize";
  state.phaseElapsedMs = 0;
  state.primaryId = primary.id;
  state.hasLockedPlane = true;
}

function computeCircleNowLockedPlane(
  ship: ControlledBodyState,
  primary: DominantPrimary,
  outPlaneNormal: Vec3,
): boolean {
  const state = computeCircleNowState(ship, primary);
  if (!state) return false;

  vec3.crossInto(outPlaneNormal, circleRScratch, circleVRelScratch);
  const normalLen = vec3.length(outPlaneNormal);
  if (normalLen > EPS_LEN_COARSE) {
    vec3.scaleInto(outPlaneNormal, 1 / normalLen, outPlaneNormal);
    return true;
  }

  if (projectOntoPlane(circleTScratch, ship.frame.right, circleRHatScratch)) {
    vec3.crossInto(outPlaneNormal, circleRHatScratch, circleTScratch);
    return true;
  }

  if (projectOntoPlane(circleTScratch, ship.frame.up, circleRHatScratch)) {
    vec3.crossInto(outPlaneNormal, circleRHatScratch, circleTScratch);
    return true;
  }

  return false;
}

function computeCircleNowVectorGuidance(
  ship: ControlledBodyState,
  world: World,
  controllerState?: CircleNowControllerState,
): CircleNowVectorGuidance | null {
  if (!controllerState?.primaryId || !controllerState.hasLockedPlane) {
    return null;
  }

  const primary = findDominantPrimaryById(world, controllerState.primaryId);
  if (!primary) return null;

  vec3.subInto(circleRScratch, ship.position, primary.body.position);
  const r = vec3.length(circleRScratch);
  if (r <= 0) return null;
  vec3.scaleInto(circleRHatScratch, 1 / r, circleRScratch);

  vec3.crossInto(
    circleTScratch,
    controllerState.lockedPlaneNormal,
    circleRHatScratch,
  );
  const tangentLen = vec3.length(circleTScratch);
  if (tangentLen <= EPS_LEN_COARSE) return null;
  vec3.scaleInto(circleTScratch, 1 / tangentLen, circleTScratch);

  vec3.subInto(circleVRelScratch, ship.velocity, primary.body.velocity);
  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return null;
  const circularSpeed = Math.sqrt(mu / r);
  vec3.scaleInto(circleTargetVelocityScratch, circularSpeed, circleTScratch);
  vec3.subInto(
    circleDeltaVScratch,
    circleTargetVelocityScratch,
    circleVRelScratch,
  );

  circleVectorGuidanceScratch.deltaVMag = vec3.length(circleDeltaVScratch);
  return circleVectorGuidanceScratch;
}

function computeCircleNowVectorAttitudeCommand(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  controllerState?: CircleNowControllerState,
): AttitudeCommand | null {
  const guidance = computeCircleNowVectorGuidance(ship, world, controllerState);
  if (!guidance) return null;

  if (
    controllerState?.phase === "vectorFinished" ||
    guidance.deltaVMag <= circleNowVectorDoneDeltaVMps
  ) {
    return computeCircleNowVectorFinishedAttitudeCommand(
      dtMillis,
      ship,
      world,
      controllerState,
    );
  }

  getClosestDirectionOnLine(
    circleTargetDirectionScratch,
    ship,
    circleDeltaVScratch,
    guidance.deltaVMag,
  );
  const command = computeAlignToDirectionCommand(
    dtMillis,
    ship,
    circleTargetDirectionScratch,
  );

  return {
    roll: 0,
    pitch: command?.pitch ?? 0,
    yaw: command?.yaw ?? 0,
  };
}

function computeCircleNowVectorFinishedAttitudeCommand(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  controllerState?: CircleNowControllerState,
): AttitudeCommand {
  const primary =
    controllerState?.primaryId != null
      ? findDominantPrimaryById(world, controllerState.primaryId)
      : null;
  if (!primary) {
    return {
      roll: 0,
      pitch: 0,
      yaw: 0,
    };
  }

  vec3.subInto(
    circleTargetDirectionScratch,
    primary.body.position,
    ship.position,
  );
  const command = computeAlignToDirectionCommand(
    dtMillis,
    ship,
    circleTargetDirectionScratch,
  );
  return {
    roll: 0,
    pitch: command?.pitch ?? 0,
    yaw: command?.yaw ?? 0,
  };
}

function findDominantPrimaryById(
  world: World,
  primaryId: string,
): DominantPrimary | null {
  const planetCount = Math.min(
    world.planets.length,
    world.planetPhysics.length,
  );
  for (let i = 0; i < planetCount; i++) {
    const body = world.planets[i];
    if (body.id !== primaryId) continue;
    const physics = world.planetPhysics[i];
    return {
      id: body.id,
      body,
      mass: physics.mass,
      radius: physics.physicalRadius,
    };
  }

  const starCount = Math.min(world.stars.length, world.starPhysics.length);
  for (let i = 0; i < starCount; i++) {
    const body = world.stars[i];
    if (body.id !== primaryId) continue;
    const physics = world.starPhysics[i];
    return {
      id: body.id,
      body,
      mass: physics.mass,
      radius: physics.physicalRadius,
    };
  }

  return null;
}

function projectOntoPlane(out: Vec3, vector: Vec3, planeNormal: Vec3): boolean {
  const dot = vec3.dot(vector, planeNormal);
  vec3.scaleInto(circleProjScratch, dot, planeNormal);
  vec3.subInto(out, vector, circleProjScratch);
  const len = vec3.length(out);
  if (len <= EPS_LEN) return false;
  vec3.scaleInto(out, 1 / len, out);
  return true;
}

function getClosestDirectionOnLine(
  out: Vec3,
  ship: ControlledBodyState,
  direction: Vec3,
  directionMag: number,
): Vec3 {
  vec3.scaleInto(out, 1 / directionMag, direction);
  if (vec3.dot(ship.frame.forward, out) < 0) {
    vec3.scaleInto(out, -1, out);
  }
  return out;
}

function getClosestVelocityLineDirection(
  state: ControlledBodyState,
): Vec3 | null {
  const velocity = getVelocityDirection(state);
  if (!velocity) return null;

  if (vec3.dot(state.frame.forward, velocity) >= 0) {
    return velocity;
  }

  vec3.scaleInto(velocityScratch, -1, velocity);
  return velocityScratch;
}

function computeInwardAlignmentDeg(ship: ControlledBodyState): number {
  const dot = -vec3.dot(ship.frame.forward, circleRHatScratch);
  return Math.acos(clamp(dot, -1, 1)) * RAD_TO_DEG;
}

function computeRollAlignmentDeg(
  state: ControlledBodyState,
  targetDirection: Vec3,
): number {
  const len = vec3.length(targetDirection);
  if (len === 0) return NaN;

  const forward = state.frame.forward;
  vec3.scaleInto(rollProjectedScratch, 1 / len, targetDirection);
  const proj = vec3.dot(rollProjectedScratch, forward);
  vec3.scaleInto(rollAxisScratch, proj, forward);
  vec3.subInto(rollProjectedScratch, rollProjectedScratch, rollAxisScratch);

  const projLen = vec3.length(rollProjectedScratch);
  if (projLen < EPS_LEN) return NaN;
  vec3.scaleInto(rollProjectedScratch, 1 / projLen, rollProjectedScratch);

  const currentRight = state.frame.right;
  const dot = vec3.dot(currentRight, rollProjectedScratch);
  const angle = Math.acos(clamp(dot, -1, 1));
  vec3.crossInto(rollAxisScratch, currentRight, rollProjectedScratch);
  const sign = vec3.dot(rollAxisScratch, forward) >= 0 ? 1 : -1;
  return angle * sign * RAD_TO_DEG;
}

function computeActuatorPlaneScore(
  ship: ControlledBodyState,
  deltaV: Vec3,
  deltaVMag: number,
): number {
  const forwardDot = vec3.dot(deltaV, ship.frame.forward) / deltaVMag;
  const rightDot = vec3.dot(deltaV, ship.frame.right) / deltaVMag;
  return Math.hypot(forwardDot, rightDot);
}

function isCircleNowNoseAcquired(
  ship: ControlledBodyState,
  guidance: CircleNowGuidance,
  phaseElapsedMs: number,
): boolean {
  const pitchYawRate = Math.hypot(
    ship.angularVelocity.pitch,
    ship.angularVelocity.yaw,
  );
  if (
    guidance.inwardAlignmentDeg <= circleNowNoseAlignedDeg &&
    pitchYawRate <= circleNowNosePitchYawRateMax
  ) {
    return true;
  }

  return (
    phaseElapsedMs >= circleNowNoseFallbackMs &&
    guidance.inwardAlignmentDeg <= circleNowNoseFallbackAlignedDeg
  );
}

function isCircleNowPlaneAcquired(
  guidance: CircleNowGuidance,
  phaseElapsedMs: number,
): boolean {
  const rollError = Math.abs(guidance.tangentialRollAlignmentDeg);
  if (!Number.isFinite(rollError)) return false;

  if (rollError <= circleNowRollAlignedDeg) return true;
  if (
    rollError <= circleNowRollGoodEnoughDeg &&
    guidance.actuatorPlaneScore >= circleNowPlaneGoodEnoughScore
  ) {
    return true;
  }

  return (
    phaseElapsedMs >= circleNowPlaneTimeoutMs &&
    guidance.actuatorPlaneScore >= circleNowPlaneTimeoutScore
  );
}

function isCircleNowSpeedCalibrated(
  ship: ControlledBodyState,
  guidance: CircleNowGuidance,
): boolean {
  const speed = vec3.length(ship.velocity);
  const speedError = Math.abs(guidance.circularSpeed - speed);
  return speedError <= circleNowSpeedCalibrationToleranceMps;
}

function getCircleNowRollCorrectionScale(
  ship: ControlledBodyState,
  tangential: Vec3,
): number {
  const rollError = Math.abs(computeRollAlignmentDeg(ship, tangential));
  if (!Number.isFinite(rollError) || rollError <= circleNowMinorRollDeg) {
    return 0;
  }
  return rollError <= circleNowFullRollDeg ? 0.5 : 1;
}

function computeCircleNowState(
  ship: ControlledBodyState,
  primary: DominantPrimary,
): CircleNowState | null {
  vec3.subInto(circleRScratch, ship.position, primary.body.position);
  const r2 = vec3.lengthSq(circleRScratch);
  if (r2 === 0) return null;
  const r = Math.sqrt(r2);
  vec3.scaleInto(circleRHatScratch, 1 / r, circleRScratch);

  vec3.subInto(circleVRelScratch, ship.velocity, primary.body.velocity);
  const radialSpeed = vec3.dot(circleRHatScratch, circleVRelScratch);

  const { tangentialSpeed, hasTangentialDir } =
    computeCircleTangentialDirection(
      ship,
      circleRHatScratch,
      circleVRelScratch,
      radialSpeed,
      circleTScratch,
    );

  circleStateScratch.r = r;
  circleStateScratch.radialSpeed = radialSpeed;
  circleStateScratch.tangentialSpeed = tangentialSpeed;
  circleStateScratch.hasTangentialDir = hasTangentialDir;
  return circleStateScratch;
}

function computeCircleTangentialDirection(
  ship: ControlledBodyState,
  rHat: Vec3,
  vRel: Vec3,
  radialSpeed: number,
  outT: Vec3,
): { tangentialSpeed: number; hasTangentialDir: boolean } {
  vec3.scaleInto(outT, radialSpeed, rHat);
  vec3.subInto(outT, vRel, outT);
  const tangentialSpeed = vec3.length(outT);
  if (tangentialSpeed > EPS_SPEED_FINE) {
    vec3.scaleInto(outT, 1 / tangentialSpeed, outT);
    return { tangentialSpeed, hasTangentialDir: true };
  }

  vec3.copyInto(outT, ship.frame.right);
  const proj = vec3.dot(outT, rHat);
  vec3.scaleInto(circleProjScratch, proj, rHat);
  vec3.subInto(outT, outT, circleProjScratch);
  const projLen = vec3.length(outT);
  if (projLen > EPS_LEN) {
    vec3.scaleInto(outT, 1 / projLen, outT);
    return { tangentialSpeed: 0, hasTangentialDir: true };
  }

  return { tangentialSpeed: 0, hasTangentialDir: false };
}

function computeCircleDeltaV(
  radialSpeed: number,
  tangentialSpeed: number,
  hasTangentialDir: boolean,
  circularSpeed: number,
  rHat: Vec3,
  tangentialDir: Vec3,
  outDeltaV: Vec3,
): number {
  const deltaVRadial = -radialSpeed;
  const deltaVTangential = circularSpeed - tangentialSpeed;

  vec3.scaleInto(outDeltaV, deltaVRadial, rHat);
  if (hasTangentialDir) {
    vec3.scaleInto(circleAccelScratch, deltaVTangential, tangentialDir);
    vec3.addInto(outDeltaV, outDeltaV, circleAccelScratch);
  }

  return vec3.length(outDeltaV);
}

function computeCircleAcceleration(
  deltaV: Vec3,
  deltaVMag: number,
  maxThrustAcceleration: number,
  dtSec: number,
  outAccel: Vec3,
): boolean {
  const maxDeltaV = maxThrustAcceleration * dtSec;
  if (maxDeltaV <= 0) return false;

  const scale = deltaVMag > maxDeltaV ? maxDeltaV / deltaVMag : 1;
  vec3.scaleInto(outAccel, scale / dtSec, deltaV);
  return true;
}

function computeCircleNowThrust(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  maxThrustAcceleration: number,
  maxRcsTranslationAcceleration: number,
  algorithmVersion: AutopilotAlgorithmVersion,
): PropulsionCommand {
  if (maxThrustAcceleration === 0) {
    return circleZeroPropulsion;
  }
  const dtSec = dtMillis / 1000;
  if (dtSec === 0) return circleZeroPropulsion;

  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return circleZeroPropulsion;

  const state = computeCircleNowState(ship, primary);
  if (!state) return circleZeroPropulsion;

  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return circleZeroPropulsion;

  const circularSpeed = Math.sqrt(mu / state.r);
  const deltaVMag = computeCircleDeltaV(
    state.radialSpeed,
    state.tangentialSpeed,
    state.hasTangentialDir,
    circularSpeed,
    circleRHatScratch,
    circleTScratch,
    circleDeltaVScratch,
  );
  if (deltaVMag < EPS_DELTA_V) return circleZeroPropulsion;

  const hasAcceleration = computeCircleAcceleration(
    circleDeltaVScratch,
    deltaVMag,
    maxThrustAcceleration,
    dtSec,
    circleAccelScratch,
  );
  if (!hasAcceleration) return circleZeroPropulsion;

  const authorityScale = usesCircleNowPropulsionGating(algorithmVersion)
    ? getCircleNowPropulsionAuthorityScale(
        computeActuatorPlaneScore(
          ship,
          circleAccelScratch,
          vec3.length(circleAccelScratch),
        ),
      )
    : 1;
  if (authorityScale <= 0) return circleZeroPropulsion;

  const forwardCmd =
    (vec3.dot(circleAccelScratch, ship.frame.forward) / maxThrustAcceleration) *
    authorityScale;

  const rightCmd =
    maxRcsTranslationAcceleration > 0
      ? (vec3.dot(circleAccelScratch, ship.frame.right) /
          maxRcsTranslationAcceleration) *
        authorityScale
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

function computeCircleNowVectorThrust(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  maxThrustAcceleration: number,
  maxRcsTranslationAcceleration: number,
  controllerState?: CircleNowControllerState,
): PropulsionCommand {
  if (maxThrustAcceleration === 0) {
    return circleZeroPropulsion;
  }
  const dtSec = dtMillis / 1000;
  if (dtSec === 0) return circleZeroPropulsion;

  const guidance = computeCircleNowVectorGuidance(ship, world, controllerState);
  if (
    !guidance ||
    controllerState?.phase === "vectorFinished" ||
    guidance.deltaVMag <= circleNowVectorDoneDeltaVMps
  ) {
    return circleZeroPropulsion;
  }

  const deltaVLineAlignment =
    Math.abs(vec3.dot(circleDeltaVScratch, ship.frame.forward)) /
    guidance.deltaVMag;
  const minAlignment = Math.cos(circleNowVectorAlignedDeg / RAD_TO_DEG);
  if (deltaVLineAlignment < minAlignment) {
    return circleZeroPropulsion;
  }

  const hasAcceleration = computeCircleAcceleration(
    circleDeltaVScratch,
    guidance.deltaVMag,
    maxThrustAcceleration,
    dtSec,
    circleAccelScratch,
  );
  if (!hasAcceleration) return circleZeroPropulsion;

  const fullAlignment = Math.cos(circleNowVectorFullAuthorityDeg / RAD_TO_DEG);
  const authorityScale = clamp(
    (deltaVLineAlignment - minAlignment) / (fullAlignment - minAlignment),
    0,
    1,
  );

  const forwardAccel = vec3.dot(circleAccelScratch, ship.frame.forward);
  const actualMainAccel = forwardAccel * authorityScale;
  vec3.scaleInto(circleProjScratch, actualMainAccel, ship.frame.forward);
  vec3.subInto(circleResidualScratch, circleAccelScratch, circleProjScratch);

  const rightCmd =
    maxRcsTranslationAcceleration > 0
      ? vec3.dot(circleResidualScratch, ship.frame.right) /
        maxRcsTranslationAcceleration
      : 0;

  return {
    main: {
      forward: clamp(actualMainAccel / maxThrustAcceleration, -1, 1),
    },
    rcs: {
      right: clamp(rightCmd, -1, 1),
    },
  };
}

function computeCircleNowSpeedCalibrationThrust(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  maxThrustAcceleration: number,
): PropulsionCommand {
  if (maxThrustAcceleration === 0) {
    return circleZeroPropulsion;
  }
  const dtSec = dtMillis / 1000;
  if (dtSec === 0) return circleZeroPropulsion;

  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return circleZeroPropulsion;

  const state = computeCircleNowState(ship, primary);
  if (!state) return circleZeroPropulsion;

  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return circleZeroPropulsion;

  const speed = vec3.length(ship.velocity);
  if (speed <= EPS_SPEED_FINE) return circleZeroPropulsion;

  const velocityDir = getVelocityDirection(ship);
  if (!velocityDir) return circleZeroPropulsion;

  const velocityLineAlignment = Math.abs(
    vec3.dot(ship.frame.forward, velocityDir),
  );
  if (
    velocityLineAlignment <
    Math.cos(circleNowSpeedCalibrationAlignedDeg / RAD_TO_DEG)
  ) {
    return circleZeroPropulsion;
  }

  const circularSpeed = Math.sqrt(mu / state.r);
  const speedDelta = circularSpeed - speed;
  if (Math.abs(speedDelta) <= circleNowSpeedCalibrationToleranceMps) {
    return circleZeroPropulsion;
  }

  vec3.scaleInto(circleDeltaVScratch, speedDelta, velocityDir);
  const hasAcceleration = computeCircleAcceleration(
    circleDeltaVScratch,
    Math.abs(speedDelta),
    maxThrustAcceleration,
    dtSec,
    circleAccelScratch,
  );
  if (!hasAcceleration) return circleZeroPropulsion;

  return {
    main: {
      forward: clamp(
        vec3.dot(circleAccelScratch, ship.frame.forward) /
          maxThrustAcceleration,
        -1,
        1,
      ),
    },
    rcs: circleZeroRcs,
  };
}

function computeCircleNowRadialThrust(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  maxThrustAcceleration: number,
): PropulsionCommand {
  if (maxThrustAcceleration === 0) {
    return circleZeroPropulsion;
  }
  const dtSec = dtMillis / 1000;
  if (dtSec === 0) return circleZeroPropulsion;

  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return circleZeroPropulsion;

  const state = computeCircleNowState(ship, primary);
  if (!state) return circleZeroPropulsion;

  const inwardAlignmentDeg = computeInwardAlignmentDeg(ship);
  if (
    !Number.isFinite(inwardAlignmentDeg) ||
    inwardAlignmentDeg > circleNowRadialBrakingAlignedDeg
  ) {
    return circleZeroPropulsion;
  }

  const radialDeltaV = -state.radialSpeed;
  if (Math.abs(radialDeltaV) < EPS_DELTA_V) {
    return circleZeroPropulsion;
  }

  vec3.scaleInto(circleDeltaVScratch, radialDeltaV, circleRHatScratch);
  const hasAcceleration = computeCircleAcceleration(
    circleDeltaVScratch,
    Math.abs(radialDeltaV),
    maxThrustAcceleration,
    dtSec,
    circleAccelScratch,
  );
  if (!hasAcceleration) return circleZeroPropulsion;

  return {
    main: {
      forward: clamp(
        vec3.dot(circleAccelScratch, ship.frame.forward) /
          maxThrustAcceleration,
        -1,
        1,
      ),
    },
    rcs: circleZeroRcs,
  };
}

function getCircleNowPropulsionAuthorityScale(
  actuatorPlaneScore: number,
): number {
  if (
    !Number.isFinite(actuatorPlaneScore) ||
    actuatorPlaneScore < circleNowPropulsionMinScore
  ) {
    return 0;
  }
  if (actuatorPlaneScore >= circleNowPropulsionFullScore) {
    return 1;
  }
  return (
    (actuatorPlaneScore - circleNowPropulsionMinScore) /
    (circleNowPropulsionFullScore - circleNowPropulsionMinScore)
  );
}

export function resolveAutopilotPropulsionCommand(
  dtMillis: number,
  controlInput: ControlInput,
  ship: ControlledBodyState,
  world: World,
  manualPropulsion: PropulsionCommand,
  maxThrustAcceleration: number,
  maxRcsTranslationAcceleration: number,
  algorithmVersion: AutopilotAlgorithmVersion = defaultAutopilotAlgorithmVersion,
  controllerState?: CircleNowControllerState,
): PropulsionCommand {
  if (!controlInput.circleNow) {
    return manualPropulsion;
  }

  if (algorithmVersion === "v5") {
    return computeCircleNowVectorThrust(
      dtMillis,
      ship,
      world,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
      controllerState,
    );
  }

  if (
    algorithmVersion === "v2" &&
    controllerState &&
    (controllerState.phase === "acquireNose" ||
      controllerState.phase === "acquirePlane")
  ) {
    return circleZeroPropulsion;
  }

  if (
    algorithmVersion === "v3" &&
    controllerState &&
    (controllerState.phase === "acquireNose" ||
      controllerState.phase === "acquirePlane")
  ) {
    return computeCircleNowRadialThrust(
      dtMillis,
      ship,
      world,
      maxThrustAcceleration,
    );
  }

  if (
    algorithmVersion === "v4" &&
    controllerState?.phase === "calibrateSpeed"
  ) {
    return computeCircleNowSpeedCalibrationThrust(
      dtMillis,
      ship,
      world,
      maxThrustAcceleration,
    );
  }

  return computeCircleNowThrust(
    dtMillis,
    ship,
    world,
    maxThrustAcceleration,
    maxRcsTranslationAcceleration,
    algorithmVersion,
  );
}

export type AutopilotMode =
  | "none"
  | "alignToVelocity"
  | "alignToBody"
  | "circleNow";

export function getAutopilotMode(controlInput: ControlInput): AutopilotMode {
  if (controlInput.circleNow) return "circleNow";
  if (controlInput.alignToBody) return "alignToBody";
  if (controlInput.alignToVelocity) return "alignToVelocity";
  return "none";
}

export function disengageOnManualActuation(
  controlInput: ControlInput,
): boolean {
  if (!hasManualActuatorInput(controlInput)) {
    return false;
  }
  controlInput.alignToVelocity = false;
  controlInput.alignToBody = false;
  controlInput.circleNow = false;
  return true;
}

function hasManualActuatorInput(controlInput: ControlInput): boolean {
  return (
    controlInput.burnForward ||
    controlInput.burnBackwards ||
    controlInput.burnLeft ||
    controlInput.burnRight ||
    controlInput.rollLeft ||
    controlInput.rollRight ||
    controlInput.pitchUp ||
    controlInput.pitchDown ||
    controlInput.yawLeft ||
    controlInput.yawRight
  );
}

function usesCircleNowControllerState(
  algorithmVersion: AutopilotAlgorithmVersion,
): boolean {
  return (
    algorithmVersion === "v2" ||
    algorithmVersion === "v3" ||
    algorithmVersion === "v4" ||
    algorithmVersion === "v5"
  );
}

function usesCircleNowPropulsionGating(
  algorithmVersion: AutopilotAlgorithmVersion,
): boolean {
  return algorithmVersion === "v2" || algorithmVersion === "v3";
}

function getInitialCircleNowPhase(
  algorithmVersion: AutopilotAlgorithmVersion,
): CircleNowPhase {
  if (algorithmVersion === "v4") return "calibrateSpeed";
  if (algorithmVersion === "v5") return "vectorCircularize";
  return "acquireNose";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
