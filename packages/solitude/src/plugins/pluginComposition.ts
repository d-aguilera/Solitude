import {
  createSpacecraftOperatorTelemetry,
  type SpacecraftOperatorTelemetry,
} from "@solitude/sim/plugins/spacecraftOperator/telemetry";

export interface PluginCompositionContext {
  spacecraftOperatorTelemetry: SpacecraftOperatorTelemetry;
}

export function createPluginCompositionContext(): PluginCompositionContext {
  return {
    spacecraftOperatorTelemetry: createSpacecraftOperatorTelemetry(),
  };
}
