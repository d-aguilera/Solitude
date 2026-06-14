import type {
  ControlInput,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";
import type { ControlledBody, World } from "@solitude/engine/world";

export const localPredictionCapability = "solitude.localPrediction.v1";

export interface LocalEntityPredictionParams {
  controlInput: ControlInput;
  controlledBody: ControlledBody;
  dtMillis: number;
  world: World;
}

export interface LocalEntityPredictionProvider {
  canPredictEntity: (controlledBody: ControlledBody, world: World) => boolean;
  predictEntity: (params: LocalEntityPredictionParams) => void;
  resetPrediction: () => void;
}

export function createLocalEntityPredictionProvider(
  provider: LocalEntityPredictionProvider,
): PluginCapabilityProvider {
  return {
    id: localPredictionCapability,
    value: provider,
  };
}

export function collectLocalEntityPredictionProviders(
  capabilityRegistry: PluginCapabilityRegistry,
): LocalEntityPredictionProvider[] {
  return capabilityRegistry
    .getAll(localPredictionCapability)
    .filter(isLocalEntityPredictionProvider);
}

function isLocalEntityPredictionProvider(
  value: unknown,
): value is LocalEntityPredictionProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "canPredictEntity" in value &&
    typeof value.canPredictEntity === "function" &&
    "predictEntity" in value &&
    typeof value.predictEntity === "function" &&
    "resetPrediction" in value &&
    typeof value.resetPrediction === "function"
  );
}
