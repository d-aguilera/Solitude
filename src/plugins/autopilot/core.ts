import type { ControlPlugin } from "../../app/pluginPorts";
import {
  getAutopilotAttitudeCommand,
  resolveAutopilotPropulsionCommand,
} from "./logic";

export function createControlPlugin(): ControlPlugin {
  const resolvePropulsionCommand = createImmediatePropulsionResolver();

  return {
    updateControlState: (_) => {},
    getAttitudeCommand: (params) =>
      getAutopilotAttitudeCommand(
        params.dtMillis,
        params.controlledBody,
        params.controlInput,
        params.world,
      ),
    resolvePropulsionCommand,
  };
}

type PropulsionResolver = NonNullable<
  ControlPlugin["resolvePropulsionCommand"]
>;

function createImmediatePropulsionResolver(): PropulsionResolver {
  return (params) =>
    resolveAutopilotPropulsionCommand(
      params.dtMillis,
      params.controlInput,
      params.controlledBody,
      params.world,
      params.manualPropulsion,
      params.maxThrustAcceleration,
      params.maxRcsTranslationAcceleration,
    );
}
