import {
  createSpacecraftOperatorTelemetry,
  type SpacecraftOperatorTelemetry,
} from "./spacecraftOperator/telemetry";

export interface PluginCompositionContext {
  spacecraftOperatorTelemetry: SpacecraftOperatorTelemetry;
}

export function createPluginCompositionContext(): PluginCompositionContext {
  return {
    spacecraftOperatorTelemetry: createSpacecraftOperatorTelemetry(),
  };
}
