import type { ControlPlugin } from "../../app/pluginPorts";
import {
  createCircleNowControllerState,
  disengageOnManualActuation,
  getAutopilotAttitudeCommand,
  resetCircleNowControllerState,
  resolveAutopilotPropulsionCommand,
  updateCircleNowControllerState,
} from "./logic";
import {
  defaultAutopilotAlgorithmVersion,
  type AutopilotAlgorithmVersion,
} from "./version";

export function createControlPlugin(
  algorithmVersion: AutopilotAlgorithmVersion = defaultAutopilotAlgorithmVersion,
): ControlPlugin {
  const circleNowState = createCircleNowControllerState();
  const resolvePropulsionCommand =
    algorithmVersion === "v2" ||
    algorithmVersion === "v3" ||
    algorithmVersion === "v4" ||
    algorithmVersion === "v5"
      ? createPhasedPropulsionResolver(algorithmVersion, circleNowState)
      : createImmediatePropulsionResolver(algorithmVersion, circleNowState);

  return {
    updateControlState: (params) => {
      if (disengageOnManualActuation(params.controlInput)) {
        resetCircleNowControllerState(circleNowState);
      } else if (!params.controlInput.circleNow) {
        resetCircleNowControllerState(circleNowState);
      }
    },
    getAttitudeCommand: (params) =>
      getAutopilotAttitudeCommand(
        params.dtMillis,
        params.ship,
        params.controlInput,
        params.world,
        algorithmVersion,
        circleNowState,
      ),
    resolvePropulsionCommand,
  };
}

type CircleNowState = ReturnType<typeof createCircleNowControllerState>;
type PropulsionResolver = NonNullable<
  ControlPlugin["resolvePropulsionCommand"]
>;

function createImmediatePropulsionResolver(
  algorithmVersion: AutopilotAlgorithmVersion,
  circleNowState: CircleNowState,
): PropulsionResolver {
  return (params) =>
    resolveAutopilotPropulsionCommand(
      params.dtMillis,
      params.controlInput,
      params.ship,
      params.world,
      params.manualPropulsion,
      params.maxThrustAcceleration,
      params.maxRcsTranslationAcceleration,
      algorithmVersion,
      circleNowState,
    );
}

function createPhasedPropulsionResolver(
  algorithmVersion: AutopilotAlgorithmVersion,
  circleNowState: CircleNowState,
): PropulsionResolver {
  return (params) => {
    updateCircleNowControllerState(
      params.dtMillis,
      params.controlInput,
      params.ship,
      params.world,
      circleNowState,
      algorithmVersion,
    );
    return resolveAutopilotPropulsionCommand(
      params.dtMillis,
      params.controlInput,
      params.ship,
      params.world,
      params.manualPropulsion,
      params.maxThrustAcceleration,
      params.maxRcsTranslationAcceleration,
      algorithmVersion,
      circleNowState,
    );
  };
}
