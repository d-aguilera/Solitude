import type { ControlPlugin } from "../../app/pluginPorts";
import {
  disengageOnManualActuation,
  getAutopilotAttitudeCommand,
  resolveAutopilotPropulsionCommand,
} from "./logic";

export function createControlPlugin(): ControlPlugin {
  return {
    updateControlState: ({ controlInput }) => {
      disengageOnManualActuation(controlInput);
    },
    getAttitudeCommand: ({ dtMillis, ship, controlInput, world }) =>
      getAutopilotAttitudeCommand(dtMillis, ship, controlInput, world),
    resolvePropulsionCommand: ({
      dtMillis,
      controlInput,
      ship,
      world,
      manualPropulsion,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
    }) =>
      resolveAutopilotPropulsionCommand(
        dtMillis,
        controlInput,
        ship,
        world,
        manualPropulsion,
        maxThrustAcceleration,
        maxRcsTranslationAcceleration,
      ),
  };
}
