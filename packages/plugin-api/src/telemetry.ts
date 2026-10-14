import type { ExternalPluginCapabilityProvider } from "./capabilities";
import type { ExternalWorld } from "./world";

export interface ExternalSpacecraftOperatorTelemetry {
  currentRcsLevel: number;
  currentThrustLevel: number;
}

export interface ExternalSpacecraftOperatorTelemetryProvider {
  readonly telemetry: ExternalSpacecraftOperatorTelemetry;
}

export const spacecraftOperatorTelemetryCapability =
  "spacecraft.operatorTelemetry.v1";

export function createSpacecraftOperatorTelemetryProvider(
  telemetry: ExternalSpacecraftOperatorTelemetry,
): ExternalPluginCapabilityProvider {
  return {
    id: spacecraftOperatorTelemetryCapability,
    value: { telemetry } satisfies ExternalSpacecraftOperatorTelemetryProvider,
  };
}

export function isSpacecraftOperatorTelemetryProvider(
  value: unknown,
): value is ExternalSpacecraftOperatorTelemetryProvider {
  const candidate =
    value as Partial<ExternalSpacecraftOperatorTelemetryProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.telemetry === "object" &&
    candidate.telemetry !== null &&
    typeof candidate.telemetry.currentThrustLevel === "number" &&
    typeof candidate.telemetry.currentRcsLevel === "number"
  );
}

export const orbitObservationCapability = "solitude.orbitObservation.v1";

/** Physical observations only: all unavailable values are explicitly cleared. */
export interface ExternalOrbitObservation {
  entityId: string;
  primaryId: string | null;
  orbitValid: boolean;
  isBound: boolean;
  altitudeMeters: number | null;
  periapsisAltitudeMeters: number | null;
  apoapsisAltitudeMeters: number | null;
  radialSpeedMetersPerSecond: number | null;
  progradeAlignmentCosine: number | null;
}
export interface ExternalOrbitObservationProvider {
  sampleInto: (
    out: ExternalOrbitObservation,
    world: ExternalWorld,
    entityId: string,
  ) => void;
}
export function createOrbitObservation(): ExternalOrbitObservation {
  return {
    entityId: "",
    primaryId: null,
    orbitValid: false,
    isBound: false,
    altitudeMeters: null,
    periapsisAltitudeMeters: null,
    apoapsisAltitudeMeters: null,
    radialSpeedMetersPerSecond: null,
    progradeAlignmentCosine: null,
  };
}
export function isOrbitObservationProvider(
  value: unknown,
): value is ExternalOrbitObservationProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ExternalOrbitObservationProvider).sampleInto === "function"
  );
}

/** Detailed physical readout; apsis distances are from the primary center.
 * Unbound apoapsis is Infinity; missing timing is null. */
export interface ExternalOrbitReadout {
  primaryId: string;
  primaryRadius: number;
  altitudeMeters: number | null;
  distance: number;
  speed: number;
  semiMajorAxis: number;
  eccentricity: number;
  inclinationRad: number;
  periapsis: number;
  apoapsis: number;
  isBound: boolean;
  radialSpeed: number;
  tangentialSpeed: number;
  circularSpeed: number;
  deltaVCircularRadial: number;
  deltaVCircularTangential: number;
  timeToPeriapsisSec: number | null;
  timeToApoapsisSec: number | null;
}

export function createOrbitReadout(): ExternalOrbitReadout {
  return {
    primaryId: "",
    primaryRadius: 0,
    altitudeMeters: null,
    distance: 0,
    speed: 0,
    semiMajorAxis: 0,
    eccentricity: 0,
    inclinationRad: 0,
    periapsis: 0,
    apoapsis: 0,
    isBound: false,
    radialSpeed: 0,
    tangentialSpeed: 0,
    circularSpeed: 0,
    deltaVCircularRadial: 0,
    deltaVCircularTangential: 0,
    timeToPeriapsisSec: null,
    timeToApoapsisSec: null,
  };
}

/** Optional detailed-readout extension used by orbital instruments. */
export interface ExternalOrbitReadoutProvider extends ExternalOrbitObservationProvider {
  /** Reuses caller storage. On false, only altitudeMeters is usable. */
  readoutInto: (
    out: ExternalOrbitReadout,
    world: ExternalWorld,
    entityId: string,
  ) => boolean;
}
export function isOrbitReadoutProvider(
  value: unknown,
): value is ExternalOrbitReadoutProvider {
  return (
    isOrbitObservationProvider(value) &&
    typeof (value as ExternalOrbitReadoutProvider).readoutInto === "function"
  );
}
