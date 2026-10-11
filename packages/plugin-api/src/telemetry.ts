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
