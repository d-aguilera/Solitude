import type { PluginCapabilityProvider } from "@solitude/engine/plugin";

export const spacecraftOperatorTelemetryCapabilityId =
  "spacecraft.operatorTelemetry.v1";

export interface SpacecraftOperatorTelemetry {
  currentThrustLevel: number;
  currentRcsLevel: number;
}

export function createSpacecraftOperatorTelemetry(): SpacecraftOperatorTelemetry {
  return {
    currentRcsLevel: 0,
    currentThrustLevel: 0,
  };
}

export interface SpacecraftOperatorTelemetryProvider {
  readonly telemetry: SpacecraftOperatorTelemetry;
}

export function createSpacecraftOperatorTelemetryProvider(
  telemetry: SpacecraftOperatorTelemetry,
): PluginCapabilityProvider {
  return {
    id: spacecraftOperatorTelemetryCapabilityId,
    value: { telemetry },
  };
}

export function isSpacecraftOperatorTelemetryProvider(
  value: unknown,
): value is SpacecraftOperatorTelemetryProvider {
  const candidate =
    value as Partial<SpacecraftOperatorTelemetryProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.telemetry === "object" &&
    candidate.telemetry !== null &&
    typeof candidate.telemetry.currentThrustLevel === "number" &&
    typeof candidate.telemetry.currentRcsLevel === "number"
  );
}
