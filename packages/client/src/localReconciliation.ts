import type { Mat3, Vec3 } from "@solitude/engine/math";
import { localFrame, mat3, vec3, type LocalFrame } from "@solitude/engine/math";
import type { RuntimeEntitySnapshot } from "@solitude/engine/runtime";
import type { AngularVelocity, ControlledBody } from "@solitude/engine/world";

export interface LocalShipVisualState {
  angularVelocity: AngularVelocity;
  frame: LocalFrame;
  orientation: RuntimeEntitySnapshot["orientation"];
  position: RuntimeEntitySnapshot["position"];
  velocity: RuntimeEntitySnapshot["velocity"];
}

export interface LocalPredictionErrorMetrics {
  correctionActiveStartCount: number;
  correctionDeferredCount: number;
  correctionSkippedCount: number;
  lastCorrectionFrameRadians: number;
  lastCorrectionPosition: number;
  maxCorrectionFrameRadians: number;
  maxCorrectionPosition: number;
  maxAngularVelocityError: number;
  maxFrameErrorRadians: number;
  maxPositionError: number;
  maxVelocityError: number;
  sampleCount: number;
  lastAngularVelocityError: number;
  lastFrameErrorRadians: number;
  lastPositionError: number;
  lastVelocityError: number;
}

export interface LocalVisualCorrection {
  active: boolean;
  durationMillis: number;
  frameDelta: Mat3;
  positionDelta: RuntimeEntitySnapshot["position"];
  startedAtMillis: number;
}

export interface LocalReconciliationState {
  correction: LocalVisualCorrection;
  metrics: LocalPredictionErrorMetrics;
}

const defaultCorrectionDurationMillis = 120;
const frameBlendRightScratch = vec3.zero();
const frameBlendForwardScratch = vec3.zero();
const correctionPositionScratch = vec3.zero();
const pendingCorrectionPositionDeltaScratch = vec3.zero();
const pendingCorrectionFrameDeltaScratch = mat3.zero();
const authoritativeOrientationScratch = mat3.zero();
const authoritativeOrientationTransposeScratch = mat3.zero();
const correctionTargetOrientationScratch = mat3.zero();
const correctionTargetFrameScratch = localFrame.zero();
const minCorrectionFrameRadians = 0.035;
const minCorrectionPosition = 100;
const restartCorrectionFrameRadians = 0.25;
const restartCorrectionPosition = 10_000;

export function createLocalReconciliationState(): LocalReconciliationState {
  return {
    correction: {
      active: false,
      durationMillis: defaultCorrectionDurationMillis,
      frameDelta: mat3.zero(),
      positionDelta: vec3.zero(),
      startedAtMillis: 0,
    },
    metrics: {
      correctionActiveStartCount: 0,
      correctionDeferredCount: 0,
      correctionSkippedCount: 0,
      lastCorrectionFrameRadians: 0,
      lastCorrectionPosition: 0,
      maxCorrectionFrameRadians: 0,
      maxCorrectionPosition: 0,
      maxAngularVelocityError: 0,
      maxFrameErrorRadians: 0,
      maxPositionError: 0,
      maxVelocityError: 0,
      sampleCount: 0,
      lastAngularVelocityError: 0,
      lastFrameErrorRadians: 0,
      lastPositionError: 0,
      lastVelocityError: 0,
    },
  };
}

export function captureLocalShipVisualState(
  into: LocalShipVisualState | null,
  body: ControlledBody,
): LocalShipVisualState {
  const state = into ?? createLocalShipVisualState();
  vec3.copyInto(state.position, body.position);
  vec3.copyInto(state.velocity, body.velocity);
  mat3.copy(body.orientation, state.orientation);
  localFrame.copyInto(state.frame, body.frame);
  state.angularVelocity.roll = body.angularVelocity.roll;
  state.angularVelocity.pitch = body.angularVelocity.pitch;
  state.angularVelocity.yaw = body.angularVelocity.yaw;
  return state;
}

export function reconcileLocalShipVisualState(
  reconciliation: LocalReconciliationState,
  predictedState: LocalShipVisualState | null,
  renderedState: LocalShipVisualState | null,
  authoritativeState: RuntimeEntitySnapshot,
  nowMillis: number,
): void {
  if (predictedState) {
    recordPredictionError(
      reconciliation.metrics,
      predictedState,
      authoritativeState,
    );
  }
  if (!renderedState || !authoritativeState.frame) {
    reconciliation.correction.active = false;
    return;
  }

  const correction = reconciliation.correction;
  vec3.subInto(
    pendingCorrectionPositionDeltaScratch,
    renderedState.position,
    authoritativeState.position,
  );
  const authoritativeOrientation = authoritativeState.frame
    ? localFrame.intoMat3(
        authoritativeOrientationScratch,
        authoritativeState.frame,
      )
    : authoritativeState.orientation;
  mat3.transposeInto(
    authoritativeOrientationTransposeScratch,
    authoritativeOrientation,
  );
  mat3.mulMat3Into(
    pendingCorrectionFrameDeltaScratch,
    renderedState.orientation,
    authoritativeOrientationTransposeScratch,
  );
  const correctionPosition = vec3.length(pendingCorrectionPositionDeltaScratch);
  const correctionFrameRadians = measureFrameErrorRadians(
    renderedState.frame,
    authoritativeState.frame,
  );
  recordCorrectionMetrics(
    reconciliation.metrics,
    correctionPosition,
    correctionFrameRadians,
  );

  if (
    correctionPosition < minCorrectionPosition &&
    correctionFrameRadians < minCorrectionFrameRadians
  ) {
    reconciliation.metrics.correctionSkippedCount++;
    return;
  }
  if (
    correction.active &&
    nowMillis - correction.startedAtMillis < correction.durationMillis &&
    correctionPosition < restartCorrectionPosition &&
    correctionFrameRadians < restartCorrectionFrameRadians
  ) {
    reconciliation.metrics.correctionDeferredCount++;
    return;
  }

  correction.active = true;
  correction.startedAtMillis = nowMillis;
  vec3.copyInto(
    correction.positionDelta,
    pendingCorrectionPositionDeltaScratch,
  );
  mat3.copy(pendingCorrectionFrameDeltaScratch, correction.frameDelta);
  reconciliation.metrics.correctionActiveStartCount++;
}

export function applyLocalVisualCorrection(
  reconciliation: LocalReconciliationState,
  body: ControlledBody,
  nowMillis: number,
): number {
  const correction = reconciliation.correction;
  if (!correction.active) return 0;

  const elapsedMillis = Math.max(0, nowMillis - correction.startedAtMillis);
  const t = Math.min(1, elapsedMillis / correction.durationMillis);
  const alpha = (1 - t) * (1 - t);
  if (alpha <= 0) {
    correction.active = false;
    return 0;
  }

  vec3.scaledAddInto(
    correctionPositionScratch,
    body.position,
    correction.positionDelta,
    alpha,
  );
  vec3.copyInto(body.position, correctionPositionScratch);
  mat3.mulMat3Into(
    correctionTargetOrientationScratch,
    correction.frameDelta,
    body.orientation,
  );
  writeLocalFrameFromMat3(
    correctionTargetFrameScratch,
    correctionTargetOrientationScratch,
  );
  blendLocalFrameInto(
    body.frame,
    body.frame,
    correctionTargetFrameScratch,
    alpha,
  );
  localFrame.intoMat3(body.orientation, body.frame);
  return alpha;
}

export function copyLocalPredictionErrorMetrics(
  metrics: LocalPredictionErrorMetrics,
): LocalPredictionErrorMetrics {
  return { ...metrics };
}

function createLocalShipVisualState(): LocalShipVisualState {
  return {
    angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
    frame: localFrame.zero(),
    orientation: mat3.zero(),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function recordPredictionError(
  metrics: LocalPredictionErrorMetrics,
  predictedState: LocalShipVisualState,
  authoritativeState: RuntimeEntitySnapshot,
): void {
  const positionError = Math.sqrt(
    vec3.distSq(predictedState.position, authoritativeState.position),
  );
  const velocityError = Math.sqrt(
    vec3.distSq(predictedState.velocity, authoritativeState.velocity),
  );
  const frameErrorRadians = authoritativeState.frame
    ? measureFrameErrorRadians(predictedState.frame, authoritativeState.frame)
    : 0;
  const angularVelocityError = authoritativeState.angularVelocity
    ? measureAngularVelocityError(
        predictedState.angularVelocity,
        authoritativeState.angularVelocity,
      )
    : 0;

  metrics.sampleCount++;
  metrics.lastPositionError = positionError;
  metrics.lastVelocityError = velocityError;
  metrics.lastFrameErrorRadians = frameErrorRadians;
  metrics.lastAngularVelocityError = angularVelocityError;
  metrics.maxPositionError = Math.max(metrics.maxPositionError, positionError);
  metrics.maxVelocityError = Math.max(metrics.maxVelocityError, velocityError);
  metrics.maxFrameErrorRadians = Math.max(
    metrics.maxFrameErrorRadians,
    frameErrorRadians,
  );
  metrics.maxAngularVelocityError = Math.max(
    metrics.maxAngularVelocityError,
    angularVelocityError,
  );
}

function recordCorrectionMetrics(
  metrics: LocalPredictionErrorMetrics,
  correctionPosition: number,
  correctionFrameRadians: number,
): void {
  metrics.lastCorrectionPosition = correctionPosition;
  metrics.lastCorrectionFrameRadians = correctionFrameRadians;
  metrics.maxCorrectionPosition = Math.max(
    metrics.maxCorrectionPosition,
    correctionPosition,
  );
  metrics.maxCorrectionFrameRadians = Math.max(
    metrics.maxCorrectionFrameRadians,
    correctionFrameRadians,
  );
}

function measureAngularVelocityError(
  a: AngularVelocity,
  b: AngularVelocity,
): number {
  const roll = a.roll - b.roll;
  const pitch = a.pitch - b.pitch;
  const yaw = a.yaw - b.yaw;
  return Math.hypot(roll, pitch, yaw);
}

function measureFrameErrorRadians(
  a: Readonly<LocalFrame>,
  b: Readonly<LocalFrame>,
): number {
  const averageAxisDot =
    (vec3.dot(a.right, b.right) +
      vec3.dot(a.forward, b.forward) +
      vec3.dot(a.up, b.up)) /
    3;
  return Math.acos(clamp(averageAxisDot, -1, 1));
}

function blendLocalFrameInto(
  into: LocalFrame,
  from: Readonly<LocalFrame>,
  to: Readonly<LocalFrame>,
  alpha: number,
): void {
  vec3.lerpInto(frameBlendRightScratch, from.right, to.right, alpha);
  vec3.copyInto(into.right, frameBlendRightScratch);
  vec3.normalizeInto(into.right);
  vec3.lerpInto(frameBlendForwardScratch, from.forward, to.forward, alpha);
  const forwardDotRight = vec3.dot(frameBlendForwardScratch, into.right);
  vec3.scaleInto(into.forward, forwardDotRight, into.right);
  vec3.subInto(into.forward, frameBlendForwardScratch, into.forward);
  vec3.normalizeInto(into.forward);
  vec3.crossInto(into.up, into.right, into.forward);
  vec3.normalizeInto(into.up);
}

function writeLocalFrameFromMat3(
  into: LocalFrame,
  orientation: Readonly<Mat3>,
): void {
  writeVec3FromMat3Column(into.right, orientation, 0);
  writeVec3FromMat3Column(into.forward, orientation, 1);
  writeVec3FromMat3Column(into.up, orientation, 2);
}

function writeVec3FromMat3Column(
  into: Vec3,
  matrix: Readonly<Mat3>,
  column: number,
): void {
  into.x = matrix[0][column];
  into.y = matrix[1][column];
  into.z = matrix[2][column];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
