import type { ControlPlugin } from "../../app/pluginPorts";
import {
  disengageOnManualActuation,
  getAutopilotAttitudeCommand,
  resolveAutopilotPropulsionCommand,
} from "./logic";

export function createControlPlugin(): ControlPlugin {
  return {
    updateControlState: (params) => {
      disengageOnManualActuation(params.controlInput);
    },
    getAttitudeCommand: (params) =>
      getAutopilotAttitudeCommand(
        params.dtMillis,
        params.ship,
        params.controlInput,
        params.world,
      ),
    resolvePropulsionCommand: (params) =>
      resolveAutopilotPropulsionCommand(
        params.dtMillis,
        params.controlInput,
        params.ship,
        params.world,
        params.manualPropulsion,
        params.maxThrustAcceleration,
        params.maxRcsTranslationAcceleration,
      ),
  };
}
