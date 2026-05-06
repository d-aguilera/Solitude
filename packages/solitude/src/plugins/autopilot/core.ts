import type { ControlPlugin } from "@solitude/engine/app/pluginPorts";
import {
  getAutopilotAttitudeCommand,
  resolveAutopilotPropulsionCommand,
} from "./logic";
import {
  createSpacecraftPropulsionResolverProvider,
  type SpacecraftPropulsionResolver,
} from "./spacecraftPropulsion";

export function createControlPlugin(): ControlPlugin {
  return {
    updateControlState: (_) => {},
    getAttitudeCommand: (params) =>
      getAutopilotAttitudeCommand(
        params.dtMillis,
        params.controlledBody,
        params.controlInput,
        params.world,
      ),
  };
}

export function createPropulsionResolverProvider() {
  return createSpacecraftPropulsionResolverProvider(
    createImmediatePropulsionResolver(),
  );
}

function createImmediatePropulsionResolver(): SpacecraftPropulsionResolver {
  return {
    resolvePropulsionCommand: (params) =>
      resolveAutopilotPropulsionCommand(
        params.dtMillis,
        params.controlInput,
        params.controlledBody,
        params.world,
        params.manualPropulsion,
        params.maxThrustAcceleration,
        params.maxRcsTranslationAcceleration,
      ),
  };
}
