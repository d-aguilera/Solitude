import type { ExternalPluginCapabilityProvider } from "./capabilities";

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
