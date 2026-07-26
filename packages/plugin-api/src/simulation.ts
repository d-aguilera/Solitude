import type { ExternalControlInput } from "./input";
import type {
  ExternalEntityId,
  ExternalFocusContext,
  ExternalWorld,
} from "./world";

export interface ExternalSimulationPhaseParams {
  controlInput: ExternalControlInput;
  dtMillis: number;
  dtMillisSim: number;
  focusEntity: (id: ExternalEntityId) => void;
  mainFocus: ExternalFocusContext;
  world: ExternalWorld;
}

export interface ExternalSimulationPlugin {
  beforeVehicleDynamics?: (params: ExternalSimulationPhaseParams) => void;
  afterVehicleDynamics?: (params: ExternalSimulationPhaseParams) => void;
}
