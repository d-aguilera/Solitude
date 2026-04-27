import {
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
} from "../../../app/controls";
import type {
  EntityMotionState,
  ShipBody,
  World,
} from "../../../domain/domainPorts";
import { EPS_DELTA_V, EPS_LEN, EPS_SPEED_FINE } from "../../../domain/epsilon";
import { getDominantBodyPrimary } from "../../../domain/orbit";
import { type Vec3, vec3 } from "../../../domain/vec3";
import { parameters } from "../../../global/parameters";
import type { CompiledPlaybackScript } from "../types";
import type {
  PlaybackLogger,
  PlaybackLoggerLifecycleContext,
  PlaybackLoggerTickContext,
} from "./types";

export const circleNowSampleFields = [
  "playbackElapsedMs",
  "simTimeMillis",
  "primaryIndex",
  "radiusM",
  "altitudeM",
  "eccentricity",
  "radialSpeedMps",
  "tangentialSpeedMps",
  "circularSpeedMps",
  "deltaVRadialMps",
  "deltaVTangentialMps",
  "deltaVMagnitudeMps",
  "inwardAlignmentDeg",
  "tangentialRollAlignmentDeg",
  "tangentialRollAlignmentRateDegPerSec",
  "projectedTangentBearingRateDegPerSec",
  "tangentialDirectionRateDegPerSec",
  "shipForwardDirectionRateDegPerSec",
  "tangentialForwardDot",
  "tangentialProjectionLength",
  "tangentialSourceIndex",
  "desiredAccelerationMps2",
  "desiredAccelerationForwardDot",
  "desiredAccelerationRightDot",
  "desiredAccelerationUpDot",
  "mainCommand",
  "rcsCommand",
  "accelerationEfficiency",
  "angularVelocityRollRadps",
  "angularVelocityPitchRadps",
  "angularVelocityYawRadps",
  "accumulatedAbsRollDeg",
] as const;

type TangentialSource = "none" | "velocity" | "fallback";

const tangentialSources: readonly TangentialSource[] = [
  "none",
  "velocity",
  "fallback",
];
const DEG_PER_RAD = 180 / Math.PI;
const NO_PRIMARY_INDEX = -1;
const NO_PREVIOUS_PRIMARY_INDEX = -2;
const eccentricityThresholds = [0.1, 0.01, 0.001] as const;
const circleNowLogSchemaVersion = 3;

export interface CircleNowLogReport {
  kind: "circle-now";
  schemaVersion: typeof circleNowLogSchemaVersion;
  scenario: string;
  timeScale: number;
  fixedDtMillis: number;
  sampleCount: number;
  sampleFields: readonly string[];
  sampleStride: number;
  primaryIds: string[];
  tangentialSources: readonly TangentialSource[];
  summary: CircleNowLogSummary;
  samples: number[];
}

interface CircleNowLogSummary {
  activeDurationMs: number;
  activeSimDurationMs: number;
  activeStartPlaybackElapsedMs: number | null;
  initialEccentricity: number | null;
  finalEccentricity: number | null;
  minEccentricity: number | null;
  firstBelowEccentricity: Record<"0.1" | "0.01" | "0.001", number | null>;
  firstBelowEccentricityActiveMs: Record<
    "0.1" | "0.01" | "0.001",
    number | null
  >;
  totalAbsRollDeg: number;
  primaryTransitions: CircleNowPrimaryTransition[];
  minAccelerationEfficiency: number | null;
  maxAccelerationEfficiency: number | null;
  averageAccelerationEfficiency: number | null;
  finalRadiusM: number | null;
  finalAltitudeM: number | null;
  finalRadialSpeedMps: number | null;
  finalTangentialSpeedMps: number | null;
}

interface CircleNowPrimaryTransition {
  sampleIndex: number;
  playbackElapsedMs: number;
  from: string | null;
  to: string | null;
}

export interface CircleNowLogger extends PlaybackLogger {
  getReport: () => CircleNowLogReport;
}

interface CircleNowSummaryState {
  activeDurationMs: number;
  activeStartPlaybackElapsedMs: number;
  activeSimDurationMs: number;
  accelerationEfficiencyCount: number;
  accelerationEfficiencySum: number;
  finalAltitudeM: number;
  finalEccentricity: number;
  finalRadialSpeedMps: number;
  finalRadiusM: number;
  finalTangentialSpeedMps: number;
  firstBelowEccentricity001Ms: number;
  firstBelowEccentricity01Ms: number;
  firstBelowEccentricity1Ms: number;
  initialEccentricity: number;
  maxAccelerationEfficiency: number;
  minAccelerationEfficiency: number;
  minEccentricity: number;
  totalAbsRollDeg: number;
}

interface CircleNowRollDiagnostics {
  alignmentDeg: number;
  tangentialForwardDot: number;
  tangentialProjectionLength: number;
}

export function createCircleNowLogger(
  script: CompiledPlaybackScript,
): CircleNowLogger {
  const samples: number[] = [];
  const primaryIds: string[] = [];
  const primaryIndexById: Record<string, number> = {};
  const primaryTransitions: number[] = [];

  const rScratch = vec3.zero();
  const rHatScratch = vec3.zero();
  const inwardScratch = vec3.zero();
  const vRelScratch = vec3.zero();
  const hScratch = vec3.zero();
  const eVecScratch = vec3.zero();
  const tempScratch = vec3.zero();
  const tangentialScratch = vec3.zero();
  const projectedTangentialScratch = vec3.zero();
  const rollCrossScratch = vec3.zero();
  const deltaVScratch = vec3.zero();
  const desiredAccelScratch = vec3.zero();
  const actualAccelScratch = vec3.zero();
  const actualRcsScratch = vec3.zero();
  const previousTangentialScratch = vec3.zero();
  const previousForwardScratch = vec3.zero();

  const rollDiagnosticsScratch: CircleNowRollDiagnostics = {
    alignmentDeg: NaN,
    tangentialForwardDot: NaN,
    tangentialProjectionLength: NaN,
  };

  let primaryBodyScratch: EntityMotionState | null = null;
  let primaryIdScratch = "";
  let primaryMassScratch = 0;
  let primaryRadiusScratch = 0;

  let sampleCount = 0;
  let previousPrimaryIndex = NO_PREVIOUS_PRIMARY_INDEX;
  let hasPreviousDiagnostics = false;
  let previousTangentialRollAlignmentDeg = NaN;
  let previousAngularVelocityRollRadps = NaN;
  let emitted = false;

  const summary: CircleNowSummaryState = {
    activeDurationMs: 0,
    activeStartPlaybackElapsedMs: NaN,
    activeSimDurationMs: 0,
    accelerationEfficiencyCount: 0,
    accelerationEfficiencySum: 0,
    finalAltitudeM: NaN,
    finalEccentricity: NaN,
    finalRadialSpeedMps: NaN,
    finalRadiusM: NaN,
    finalTangentialSpeedMps: NaN,
    firstBelowEccentricity001Ms: NaN,
    firstBelowEccentricity01Ms: NaN,
    firstBelowEccentricity1Ms: NaN,
    initialEccentricity: NaN,
    maxAccelerationEfficiency: -Infinity,
    minAccelerationEfficiency: Infinity,
    minEccentricity: Infinity,
    totalAbsRollDeg: 0,
  };

  const onPlaybackStart = (): void => {
    reset();
  };

  const sampleAfterTick = (context: PlaybackLoggerTickContext): void => {
    if (!context.controlInput.circleNow) return;
    if (!context.world || !context.mainShip) {
      pushMissingSample(context);
      return;
    }
    pushCircleNowSample(context);
  };

  const onPlaybackEnd = (context: PlaybackLoggerLifecycleContext): void => {
    if (emitted) return;
    emitted = true;
    const scenario = context.script.id;
    console.info(
      "Solitude diagnostic log: circle-now ".concat(
        scenario,
        "\n",
        JSON.stringify(getReport(), null, 2),
      ),
    );
  };

  const getReport = (): CircleNowLogReport => ({
    kind: "circle-now",
    schemaVersion: circleNowLogSchemaVersion,
    scenario: script.id,
    timeScale: script.timeScale,
    fixedDtMillis: script.fixedDtMillis,
    sampleCount,
    sampleFields: circleNowSampleFields,
    sampleStride: circleNowSampleFields.length,
    primaryIds: primaryIds.slice(),
    tangentialSources,
    summary: buildSummary(),
    samples: samples.slice(),
  });

  return {
    getReport,
    onPlaybackEnd,
    onPlaybackStart,
    sampleAfterTick,
  };

  function reset(): void {
    samples.length = 0;
    primaryIds.length = 0;
    primaryTransitions.length = 0;
    for (const id in primaryIndexById) {
      delete primaryIndexById[id];
    }
    sampleCount = 0;
    previousPrimaryIndex = NO_PREVIOUS_PRIMARY_INDEX;
    resetPreviousDiagnostics();
    emitted = false;
    summary.activeDurationMs = 0;
    summary.activeStartPlaybackElapsedMs = NaN;
    summary.activeSimDurationMs = 0;
    summary.accelerationEfficiencyCount = 0;
    summary.accelerationEfficiencySum = 0;
    summary.finalAltitudeM = NaN;
    summary.finalEccentricity = NaN;
    summary.finalRadialSpeedMps = NaN;
    summary.finalRadiusM = NaN;
    summary.finalTangentialSpeedMps = NaN;
    summary.firstBelowEccentricity001Ms = NaN;
    summary.firstBelowEccentricity01Ms = NaN;
    summary.firstBelowEccentricity1Ms = NaN;
    summary.initialEccentricity = NaN;
    summary.maxAccelerationEfficiency = -Infinity;
    summary.minAccelerationEfficiency = Infinity;
    summary.minEccentricity = Infinity;
    summary.totalAbsRollDeg = 0;
  }

  function pushMissingSample(context: PlaybackLoggerTickContext): void {
    resetPreviousDiagnostics();
    const accumulatedAbsRollDeg = summary.totalAbsRollDeg;
    pushSample(
      context,
      NO_PRIMARY_INDEX,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      NaN,
      0,
      NaN,
      NaN,
      NaN,
      NaN,
      0,
      0,
      NaN,
      NaN,
      NaN,
      NaN,
      accumulatedAbsRollDeg,
    );
  }

  function pushCircleNowSample(context: PlaybackLoggerTickContext): void {
    const { mainShip: ship, world } = context as PlaybackLoggerTickContext & {
      mainShip: ShipBody;
      world: World;
    };
    if (!findPrimary(world, ship.position)) {
      pushMissingSample(context);
      return;
    }

    const primaryBody = primaryBodyScratch;
    if (!primaryBody) {
      pushMissingSample(context);
      return;
    }

    const primaryIndex = indexForPrimary(primaryIdScratch);
    const mu = parameters.newtonG * primaryMassScratch;
    vec3.subInto(rScratch, ship.position, primaryBody.position);
    const radiusM = vec3.length(rScratch);
    if (radiusM === 0 || mu === 0) {
      pushMissingSample(context);
      return;
    }

    vec3.scaleInto(rHatScratch, 1 / radiusM, rScratch);
    vec3.subInto(vRelScratch, ship.velocity, primaryBody.velocity);
    const v2 = vec3.lengthSq(vRelScratch);
    const radialSpeedMps = vec3.dot(rHatScratch, vRelScratch);
    const tangentialSpeedMps = Math.sqrt(
      Math.max(0, v2 - radialSpeedMps * radialSpeedMps),
    );
    const circularSpeedMps = Math.sqrt(mu / radiusM);

    vec3.crossInto(hScratch, rScratch, vRelScratch);
    vec3.crossInto(tempScratch, vRelScratch, hScratch);
    vec3.scaleInto(tempScratch, 1 / mu, tempScratch);
    vec3.subInto(eVecScratch, tempScratch, rHatScratch);
    const eccentricity = vec3.length(eVecScratch);

    const tangentialSourceIndex = computeTangentialDirectionIndex(
      ship,
      radialSpeedMps,
    );
    const deltaVRadialMps = -radialSpeedMps;
    const deltaVTangentialMps = circularSpeedMps - tangentialSpeedMps;
    vec3.scaleInto(deltaVScratch, deltaVRadialMps, rHatScratch);
    if (tangentialSourceIndex !== 0) {
      vec3.scaleInto(tempScratch, deltaVTangentialMps, tangentialScratch);
      vec3.addInto(deltaVScratch, deltaVScratch, tempScratch);
    }
    const deltaVMagnitudeMps = vec3.length(deltaVScratch);

    const inwardAlignmentDeg = computeInwardAlignmentDeg(ship);
    const rawRollDiagnostics =
      tangentialSourceIndex === 0
        ? null
        : computeTangentialRollDiagnostics(ship);
    const rollDiagnostics =
      rawRollDiagnostics && Number.isFinite(rawRollDiagnostics.alignmentDeg)
        ? rawRollDiagnostics
        : null;
    const tangentialRollAlignmentDeg = rollDiagnostics?.alignmentDeg ?? NaN;
    const dtSec = context.dtTickMillis / 1000;
    const rollRates = computeRollRates(
      dtSec,
      tangentialRollAlignmentDeg,
      ship.angularVelocity.roll,
    );
    const tangentialDirectionRateDegPerSec =
      !rollDiagnostics || dtSec <= 0 || !hasPreviousDiagnostics
        ? NaN
        : directionRateDegPerSec(
            previousTangentialScratch,
            tangentialScratch,
            dtSec,
          );
    const shipForwardDirectionRateDegPerSec =
      !rollDiagnostics || dtSec <= 0 || !hasPreviousDiagnostics
        ? NaN
        : directionRateDegPerSec(
            previousForwardScratch,
            ship.frame.forward,
            dtSec,
          );

    const command = computeAccelerationCommand(
      ship,
      context.dtTickMillis,
      deltaVMagnitudeMps,
    );

    const accumulatedAbsRollDeg =
      summary.totalAbsRollDeg +
      Math.abs(ship.angularVelocity.roll) *
        (context.dtTickMillis / 1000) *
        DEG_PER_RAD;

    pushSample(
      context,
      primaryIndex,
      radiusM,
      radiusM - primaryRadiusScratch,
      eccentricity,
      radialSpeedMps,
      tangentialSpeedMps,
      circularSpeedMps,
      deltaVRadialMps,
      deltaVTangentialMps,
      deltaVMagnitudeMps,
      inwardAlignmentDeg,
      tangentialRollAlignmentDeg,
      rollRates.tangentialRollAlignmentRateDegPerSec,
      rollRates.projectedTangentBearingRateDegPerSec,
      tangentialDirectionRateDegPerSec,
      shipForwardDirectionRateDegPerSec,
      rollDiagnostics?.tangentialForwardDot ?? NaN,
      rollDiagnostics?.tangentialProjectionLength ?? NaN,
      tangentialSourceIndex,
      command.desiredAccelerationMps2,
      command.desiredAccelerationForwardDot,
      command.desiredAccelerationRightDot,
      command.desiredAccelerationUpDot,
      command.mainCommand,
      command.rcsCommand,
      command.accelerationEfficiency,
      ship.angularVelocity.roll,
      ship.angularVelocity.pitch,
      ship.angularVelocity.yaw,
      accumulatedAbsRollDeg,
    );

    if (rollDiagnostics) {
      updatePreviousDiagnostics(
        tangentialRollAlignmentDeg,
        ship.angularVelocity.roll,
        tangentialScratch,
        ship.frame.forward,
      );
    } else {
      resetPreviousDiagnostics();
    }
  }

  function computeTangentialDirectionIndex(
    ship: ShipBody,
    radialSpeedMps: number,
  ): number {
    vec3.scaleInto(tangentialScratch, radialSpeedMps, rHatScratch);
    vec3.subInto(tangentialScratch, vRelScratch, tangentialScratch);
    const tangentialLength = vec3.length(tangentialScratch);
    if (tangentialLength > EPS_SPEED_FINE) {
      vec3.scaleInto(
        tangentialScratch,
        1 / tangentialLength,
        tangentialScratch,
      );
      return 1;
    }

    vec3.copyInto(tangentialScratch, ship.frame.right);
    const proj = vec3.dot(tangentialScratch, rHatScratch);
    vec3.scaleInto(tempScratch, proj, rHatScratch);
    vec3.subInto(tangentialScratch, tangentialScratch, tempScratch);
    const projectedLength = vec3.length(tangentialScratch);
    if (projectedLength > EPS_LEN) {
      vec3.scaleInto(tangentialScratch, 1 / projectedLength, tangentialScratch);
      return 2;
    }

    return 0;
  }

  function computeInwardAlignmentDeg(ship: ShipBody): number {
    vec3.scaleInto(inwardScratch, -1, rHatScratch);
    return angleDeg(ship.frame.forward, inwardScratch);
  }

  function computeTangentialRollDiagnostics(
    ship: ShipBody,
  ): CircleNowRollDiagnostics {
    const forward = ship.frame.forward;
    const proj = vec3.dot(tangentialScratch, forward);
    rollDiagnosticsScratch.tangentialForwardDot = proj;
    vec3.scaleInto(projectedTangentialScratch, proj, forward);
    vec3.subInto(
      projectedTangentialScratch,
      tangentialScratch,
      projectedTangentialScratch,
    );
    const projectedLength = vec3.length(projectedTangentialScratch);
    rollDiagnosticsScratch.tangentialProjectionLength = projectedLength;
    if (projectedLength < EPS_LEN) {
      rollDiagnosticsScratch.alignmentDeg = NaN;
      return rollDiagnosticsScratch;
    }
    vec3.scaleInto(
      projectedTangentialScratch,
      1 / projectedLength,
      projectedTangentialScratch,
    );

    const angle = angleDeg(ship.frame.right, projectedTangentialScratch);
    vec3.crossInto(
      rollCrossScratch,
      ship.frame.right,
      projectedTangentialScratch,
    );
    const sign = vec3.dot(rollCrossScratch, forward) >= 0 ? 1 : -1;
    rollDiagnosticsScratch.alignmentDeg = angle * sign;
    return rollDiagnosticsScratch;
  }

  function computeRollRates(
    dtSec: number,
    tangentialRollAlignmentDeg: number,
    angularVelocityRollRadps: number,
  ): {
    projectedTangentBearingRateDegPerSec: number;
    tangentialRollAlignmentRateDegPerSec: number;
  } {
    if (
      dtSec <= 0 ||
      !hasPreviousDiagnostics ||
      !Number.isFinite(tangentialRollAlignmentDeg)
    ) {
      return {
        projectedTangentBearingRateDegPerSec: NaN,
        tangentialRollAlignmentRateDegPerSec: NaN,
      };
    }

    const tangentialRollAlignmentRateDegPerSec =
      shortestDeltaDeg(
        previousTangentialRollAlignmentDeg,
        tangentialRollAlignmentDeg,
      ) / dtSec;
    const averageRollDegPerSec =
      ((previousAngularVelocityRollRadps + angularVelocityRollRadps) / 2) *
      DEG_PER_RAD;

    return {
      projectedTangentBearingRateDegPerSec:
        tangentialRollAlignmentRateDegPerSec + averageRollDegPerSec,
      tangentialRollAlignmentRateDegPerSec,
    };
  }

  function computeAccelerationCommand(
    ship: ShipBody,
    dtTickMillis: number,
    deltaVMagnitudeMps: number,
  ): {
    accelerationEfficiency: number;
    desiredAccelerationMps2: number;
    desiredAccelerationForwardDot: number;
    desiredAccelerationRightDot: number;
    desiredAccelerationUpDot: number;
    mainCommand: number;
    rcsCommand: number;
  } {
    const dtSec = dtTickMillis / 1000;
    if (dtSec <= 0 || deltaVMagnitudeMps < EPS_DELTA_V) {
      return {
        accelerationEfficiency: NaN,
        desiredAccelerationForwardDot: NaN,
        desiredAccelerationMps2: 0,
        desiredAccelerationRightDot: NaN,
        desiredAccelerationUpDot: NaN,
        mainCommand: 0,
        rcsCommand: 0,
      };
    }

    const maxDeltaV = maxThrustAcceleration * dtSec;
    const scale =
      deltaVMagnitudeMps > maxDeltaV ? maxDeltaV / deltaVMagnitudeMps : 1;
    vec3.scaleInto(desiredAccelScratch, scale / dtSec, deltaVScratch);
    const desiredAccelerationMps2 = vec3.length(desiredAccelScratch);
    const desiredAccelerationForwardDot =
      desiredAccelerationMps2 > 0
        ? vec3.dot(desiredAccelScratch, ship.frame.forward) /
          desiredAccelerationMps2
        : NaN;
    const desiredAccelerationRightDot =
      desiredAccelerationMps2 > 0
        ? vec3.dot(desiredAccelScratch, ship.frame.right) /
          desiredAccelerationMps2
        : NaN;
    const desiredAccelerationUpDot =
      desiredAccelerationMps2 > 0
        ? vec3.dot(desiredAccelScratch, ship.frame.up) / desiredAccelerationMps2
        : NaN;

    const mainCommand = clamp(
      vec3.dot(desiredAccelScratch, ship.frame.forward) / maxThrustAcceleration,
      -1,
      1,
    );
    const rcsCommand =
      maxRcsTranslationAcceleration > 0
        ? clamp(
            vec3.dot(desiredAccelScratch, ship.frame.right) /
              maxRcsTranslationAcceleration,
            -1,
            1,
          )
        : 0;

    vec3.scaleInto(
      actualAccelScratch,
      mainCommand * maxThrustAcceleration,
      ship.frame.forward,
    );
    vec3.scaleInto(
      actualRcsScratch,
      rcsCommand * maxRcsTranslationAcceleration,
      ship.frame.right,
    );
    vec3.addInto(actualAccelScratch, actualAccelScratch, actualRcsScratch);

    const desiredAccelerationSq = vec3.lengthSq(desiredAccelScratch);
    const accelerationEfficiency =
      desiredAccelerationSq > 0
        ? vec3.dot(actualAccelScratch, desiredAccelScratch) /
          desiredAccelerationSq
        : NaN;

    return {
      accelerationEfficiency,
      desiredAccelerationForwardDot,
      desiredAccelerationMps2,
      desiredAccelerationRightDot,
      desiredAccelerationUpDot,
      mainCommand,
      rcsCommand,
    };
  }

  function updatePreviousDiagnostics(
    tangentialRollAlignmentDeg: number,
    angularVelocityRollRadps: number,
    tangentialDirection: Vec3,
    forwardDirection: Vec3,
  ): void {
    if (!Number.isFinite(tangentialRollAlignmentDeg)) {
      resetPreviousDiagnostics();
      return;
    }

    hasPreviousDiagnostics = true;
    previousTangentialRollAlignmentDeg = tangentialRollAlignmentDeg;
    previousAngularVelocityRollRadps = angularVelocityRollRadps;
    vec3.copyInto(previousTangentialScratch, tangentialDirection);
    vec3.copyInto(previousForwardScratch, forwardDirection);
  }

  function resetPreviousDiagnostics(): void {
    hasPreviousDiagnostics = false;
    previousTangentialRollAlignmentDeg = NaN;
    previousAngularVelocityRollRadps = NaN;
  }

  function pushSample(
    context: PlaybackLoggerTickContext,
    primaryIndex: number,
    radiusM: number,
    altitudeM: number,
    eccentricity: number,
    radialSpeedMps: number,
    tangentialSpeedMps: number,
    circularSpeedMps: number,
    deltaVRadialMps: number,
    deltaVTangentialMps: number,
    deltaVMagnitudeMps: number,
    inwardAlignmentDeg: number,
    tangentialRollAlignmentDeg: number,
    tangentialRollAlignmentRateDegPerSec: number,
    projectedTangentBearingRateDegPerSec: number,
    tangentialDirectionRateDegPerSec: number,
    shipForwardDirectionRateDegPerSec: number,
    tangentialForwardDot: number,
    tangentialProjectionLength: number,
    tangentialSourceIndex: number,
    desiredAccelerationMps2: number,
    desiredAccelerationForwardDot: number,
    desiredAccelerationRightDot: number,
    desiredAccelerationUpDot: number,
    mainCommand: number,
    rcsCommand: number,
    accelerationEfficiency: number,
    angularVelocityRollRadps: number,
    angularVelocityPitchRadps: number,
    angularVelocityYawRadps: number,
    accumulatedAbsRollDeg: number,
  ): void {
    samples.push(
      context.playbackElapsedMs,
      context.simTimeMillis,
      primaryIndex,
      radiusM,
      altitudeM,
      eccentricity,
      radialSpeedMps,
      tangentialSpeedMps,
      circularSpeedMps,
      deltaVRadialMps,
      deltaVTangentialMps,
      deltaVMagnitudeMps,
      inwardAlignmentDeg,
      tangentialRollAlignmentDeg,
      tangentialRollAlignmentRateDegPerSec,
      projectedTangentBearingRateDegPerSec,
      tangentialDirectionRateDegPerSec,
      shipForwardDirectionRateDegPerSec,
      tangentialForwardDot,
      tangentialProjectionLength,
      tangentialSourceIndex,
      desiredAccelerationMps2,
      desiredAccelerationForwardDot,
      desiredAccelerationRightDot,
      desiredAccelerationUpDot,
      mainCommand,
      rcsCommand,
      accelerationEfficiency,
      angularVelocityRollRadps,
      angularVelocityPitchRadps,
      angularVelocityYawRadps,
      accumulatedAbsRollDeg,
    );

    sampleCount++;
    updateSummary(
      context,
      primaryIndex,
      radiusM,
      altitudeM,
      eccentricity,
      radialSpeedMps,
      tangentialSpeedMps,
      accelerationEfficiency,
      accumulatedAbsRollDeg,
    );
  }

  function updateSummary(
    context: PlaybackLoggerTickContext,
    primaryIndex: number,
    radiusM: number,
    altitudeM: number,
    eccentricity: number,
    radialSpeedMps: number,
    tangentialSpeedMps: number,
    accelerationEfficiency: number,
    accumulatedAbsRollDeg: number,
  ): void {
    if (!Number.isFinite(summary.activeStartPlaybackElapsedMs)) {
      summary.activeStartPlaybackElapsedMs = context.playbackElapsedMs;
    }
    summary.activeDurationMs += context.dtTickMillis;
    summary.activeSimDurationMs += context.dtSimMillis;
    summary.finalRadiusM = radiusM;
    summary.finalAltitudeM = altitudeM;
    summary.finalRadialSpeedMps = radialSpeedMps;
    summary.finalTangentialSpeedMps = tangentialSpeedMps;
    summary.totalAbsRollDeg = accumulatedAbsRollDeg;

    if (Number.isFinite(eccentricity)) {
      if (!Number.isFinite(summary.initialEccentricity)) {
        summary.initialEccentricity = eccentricity;
      }
      summary.finalEccentricity = eccentricity;
      summary.minEccentricity = Math.min(summary.minEccentricity, eccentricity);
      updateThresholds(eccentricity, context.playbackElapsedMs);
    }

    if (Number.isFinite(accelerationEfficiency)) {
      summary.accelerationEfficiencyCount++;
      summary.accelerationEfficiencySum += accelerationEfficiency;
      summary.minAccelerationEfficiency = Math.min(
        summary.minAccelerationEfficiency,
        accelerationEfficiency,
      );
      summary.maxAccelerationEfficiency = Math.max(
        summary.maxAccelerationEfficiency,
        accelerationEfficiency,
      );
    }

    if (
      previousPrimaryIndex !== NO_PREVIOUS_PRIMARY_INDEX &&
      previousPrimaryIndex !== primaryIndex
    ) {
      primaryTransitions.push(
        sampleCount - 1,
        context.playbackElapsedMs,
        previousPrimaryIndex,
        primaryIndex,
      );
    }
    previousPrimaryIndex = primaryIndex;
  }

  function updateThresholds(
    eccentricity: number,
    playbackElapsedMs: number,
  ): void {
    if (
      eccentricity < eccentricityThresholds[0] &&
      !Number.isFinite(summary.firstBelowEccentricity1Ms)
    ) {
      summary.firstBelowEccentricity1Ms = playbackElapsedMs;
    }
    if (
      eccentricity < eccentricityThresholds[1] &&
      !Number.isFinite(summary.firstBelowEccentricity01Ms)
    ) {
      summary.firstBelowEccentricity01Ms = playbackElapsedMs;
    }
    if (
      eccentricity < eccentricityThresholds[2] &&
      !Number.isFinite(summary.firstBelowEccentricity001Ms)
    ) {
      summary.firstBelowEccentricity001Ms = playbackElapsedMs;
    }
  }

  function buildSummary(): CircleNowLogSummary {
    return {
      activeDurationMs: summary.activeDurationMs,
      activeSimDurationMs: summary.activeSimDurationMs,
      activeStartPlaybackElapsedMs: finiteOrNull(
        summary.activeStartPlaybackElapsedMs,
      ),
      initialEccentricity: finiteOrNull(summary.initialEccentricity),
      finalEccentricity: finiteOrNull(summary.finalEccentricity),
      minEccentricity: finiteOrNull(summary.minEccentricity),
      firstBelowEccentricity: {
        "0.1": finiteOrNull(summary.firstBelowEccentricity1Ms),
        "0.01": finiteOrNull(summary.firstBelowEccentricity01Ms),
        "0.001": finiteOrNull(summary.firstBelowEccentricity001Ms),
      },
      firstBelowEccentricityActiveMs: {
        "0.1": activeRelativeMs(summary.firstBelowEccentricity1Ms),
        "0.01": activeRelativeMs(summary.firstBelowEccentricity01Ms),
        "0.001": activeRelativeMs(summary.firstBelowEccentricity001Ms),
      },
      totalAbsRollDeg: summary.totalAbsRollDeg,
      primaryTransitions: buildPrimaryTransitions(),
      minAccelerationEfficiency: finiteOrNull(
        summary.minAccelerationEfficiency,
      ),
      maxAccelerationEfficiency: finiteOrNull(
        summary.maxAccelerationEfficiency,
      ),
      averageAccelerationEfficiency:
        summary.accelerationEfficiencyCount > 0
          ? summary.accelerationEfficiencySum /
            summary.accelerationEfficiencyCount
          : null,
      finalRadiusM: finiteOrNull(summary.finalRadiusM),
      finalAltitudeM: finiteOrNull(summary.finalAltitudeM),
      finalRadialSpeedMps: finiteOrNull(summary.finalRadialSpeedMps),
      finalTangentialSpeedMps: finiteOrNull(summary.finalTangentialSpeedMps),
    };
  }

  function activeRelativeMs(playbackElapsedMs: number): number | null {
    if (
      !Number.isFinite(playbackElapsedMs) ||
      !Number.isFinite(summary.activeStartPlaybackElapsedMs)
    ) {
      return null;
    }
    return Math.max(
      0,
      playbackElapsedMs - summary.activeStartPlaybackElapsedMs,
    );
  }

  function buildPrimaryTransitions(): CircleNowPrimaryTransition[] {
    const transitions: CircleNowPrimaryTransition[] = [];
    for (let i = 0; i < primaryTransitions.length; i += 4) {
      transitions.push({
        sampleIndex: primaryTransitions[i],
        playbackElapsedMs: primaryTransitions[i + 1],
        from: primaryName(primaryTransitions[i + 2]),
        to: primaryName(primaryTransitions[i + 3]),
      });
    }
    return transitions;
  }

  function indexForPrimary(id: string): number {
    const existing = primaryIndexById[id];
    if (existing !== undefined) return existing;
    const next = primaryIds.length;
    primaryIds.push(id);
    primaryIndexById[id] = next;
    return next;
  }

  function primaryName(index: number): string | null {
    if (index < 0) return null;
    return primaryIds[index] ?? null;
  }

  function findPrimary(world: World, position: Vec3): boolean {
    const primary = getDominantBodyPrimary(world, position);
    primaryBodyScratch = primary?.body ?? null;
    primaryIdScratch = primary?.id ?? "";
    primaryMassScratch = primary?.mass ?? 0;
    primaryRadiusScratch = primary?.radius ?? 0;
    return primary != null;
  }
}

function angleDeg(a: Vec3, b: Vec3): number {
  const aLen = vec3.length(a);
  const bLen = vec3.length(b);
  if (aLen === 0 || bLen === 0) return NaN;
  const dot = vec3.dot(a, b) / (aLen * bLen);
  return Math.acos(clamp(dot, -1, 1)) * DEG_PER_RAD;
}

function directionRateDegPerSec(
  previousDirection: Vec3,
  currentDirection: Vec3,
  dtSec: number,
): number {
  if (dtSec <= 0) return NaN;
  return angleDeg(previousDirection, currentDirection) / dtSec;
}

function shortestDeltaDeg(previousDeg: number, currentDeg: number): number {
  if (!Number.isFinite(previousDeg) || !Number.isFinite(currentDeg)) {
    return NaN;
  }

  let delta = currentDeg - previousDeg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
