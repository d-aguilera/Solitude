import type { ExternalPluginCapabilityProvider } from "./capabilities";
import type { ExternalControlInput } from "./input";
import type { ExternalControlledBody, ExternalWorld } from "./world";

export const localPredictionCapability = "solitude.localPrediction.v1";

export interface ExternalLocalEntityPredictionParams {
  controlInput: ExternalControlInput;
  controlledBody: ExternalControlledBody;
  dtMillis: number;
  world: ExternalWorld;
}

export interface ExternalLocalEntityPredictionProvider {
  canPredictEntity: (
    controlledBody: ExternalControlledBody,
    world: ExternalWorld,
  ) => boolean;
  predictEntity: (params: ExternalLocalEntityPredictionParams) => void;
  resetPrediction: () => void;
}

export function createLocalEntityPredictionProvider(
  provider: ExternalLocalEntityPredictionProvider,
): ExternalPluginCapabilityProvider {
  return {
    id: localPredictionCapability,
    value: provider,
  };
}

export function collectLocalEntityPredictionProviders(capabilityRegistry: {
  getAll: (id: string) => readonly unknown[];
}): ExternalLocalEntityPredictionProvider[] {
  return capabilityRegistry
    .getAll(localPredictionCapability)
    .filter(isLocalEntityPredictionProvider);
}

function isLocalEntityPredictionProvider(
  value: unknown,
): value is ExternalLocalEntityPredictionProvider {
  const candidate =
    value as Partial<ExternalLocalEntityPredictionProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.canPredictEntity === "function" &&
    typeof candidate.predictEntity === "function" &&
    typeof candidate.resetPrediction === "function"
  );
}
