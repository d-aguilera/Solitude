import type { ExternalPluginCapabilityRegistry } from "./capabilities";
import type { ExternalControlPlugin } from "./controls";
import type { ExternalControlInput } from "./input";
import type {
  ExternalEntityId,
  ExternalFocusContext,
  ExternalWorld,
} from "./world";

export interface ExternalSimulationPhaseParams {
  controlInput: ExternalControlInput;
  controlInputsByEntityId: ReadonlyMap<ExternalEntityId, ExternalControlInput>;
  dtMillis: number;
  dtMillisSim: number;
  focusEntity: (id: ExternalEntityId) => void;
  mainFocus: ExternalFocusContext;
  world: ExternalWorld;
}

export interface ExternalSimulationPlugin {
  beforeVehicleDynamics?: (params: ExternalSimulationPhaseParams) => void;
  updateVehicleDynamics?: (params: ExternalSimulationPhaseParams) => void;
  afterVehicleDynamics?: (params: ExternalSimulationPhaseParams) => void;
}

export interface ExternalVehicleDynamicsPlugin {
  updateVehicleDynamics: (params: ExternalSimulationPhaseParams) => void;
}

export interface ExternalSimulationContributionContext {
  capabilityRegistry: ExternalPluginCapabilityRegistry;
  controlPlugins: readonly ExternalControlPlugin[];
}

export type ExternalSimulationContribution =
  | ExternalSimulationPlugin
  | ((
      context: ExternalSimulationContributionContext,
    ) => ExternalSimulationPlugin);

export type ExternalVehicleDynamicsContribution =
  | ExternalVehicleDynamicsPlugin
  | ((
      context: ExternalSimulationContributionContext,
    ) => ExternalVehicleDynamicsPlugin);
