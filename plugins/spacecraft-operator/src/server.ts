import type { ExternalServerPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createSpacecraftOperatorTelemetryProvider } from "@solitude/plugin-api/telemetry";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions = {},
): ExternalServerPlugin {
  void runtimeOptions;
  const telemetry = {
    currentRcsLevel: 0,
    currentThrustLevel: 0,
  };
  return {
    id: "spacecraftOperator",
    capabilities: [createSpacecraftOperatorTelemetryProvider(telemetry)],
    hooks: {
      simulation: ({ capabilityRegistry, controlPlugins }) =>
        createSpacecraftVehicleDynamicsPlugin(
          controlPlugins,
          capabilityRegistry,
          telemetry,
        ),
    },
  };
}
