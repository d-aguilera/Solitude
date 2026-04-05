import type { ControlPlugin } from "../../app/pluginPorts.js";
import {
  disengageOnManualActuation,
  getAutopilotAttitudeCommand,
  resolveAutopilotPropulsionCommand,
} from "./logic.js";

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
