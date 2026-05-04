import type { GamePlugin, RuntimeOptions } from "../../app/pluginPorts";
import type { ViewFrameUpdateParams } from "../../app/viewPorts";
import { localFrame } from "../../domain/localFrame";
import type { PluginCompositionContext } from "../pluginComposition";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";
import { createInputPlugin } from "./input";
import { createSpacecraftOperatorTelemetry } from "./telemetry";

export function createSpacecraftOperatorPlugin(
  _runtimeOptions: RuntimeOptions = {},
  context?: PluginCompositionContext,
): GamePlugin {
  const telemetry =
    context?.spacecraftOperatorTelemetry ?? createSpacecraftOperatorTelemetry();
  return {
    id: "spacecraftOperator",
    input: createInputPlugin(),
    requirements: {
      mainFocus: [
        "controlledBody",
        "motionState",
        "localFrame",
        "angularVelocity",
      ],
    },
    simulation: (params) =>
      createSpacecraftVehicleDynamicsPlugin(
        params.controlPlugins,
        params.capabilityRegistry,
        telemetry,
      ),
    views: {
      registerViews: (registry) => {
        registry.addMainViewCameraRig({
          id: "spacecraft.forward",
          updateFrame: updateSpacecraftForwardMainViewFrame,
        });
      },
    },
  };
}

function updateSpacecraftForwardMainViewFrame({
  frame,
  mainFocus,
  mainViewLookState,
}: ViewFrameUpdateParams): void {
  localFrame.copyInto(frame, mainFocus.controlledBody.frame);
  if (mainViewLookState.azimuth !== 0)
    localFrame.rotateAroundAxisInPlace(
      frame,
      frame.up,
      mainViewLookState.azimuth,
    );
  if (mainViewLookState.elevation !== 0)
    localFrame.rotateAroundAxisInPlace(
      frame,
      frame.right,
      mainViewLookState.elevation,
    );
}
