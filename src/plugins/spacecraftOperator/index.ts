import type { GamePlugin } from "../../app/pluginPorts";
import type { ViewFrameUpdateParams } from "../../app/viewPorts";
import { localFrame } from "../../domain/localFrame";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";
import { createInputPlugin } from "./input";

export function createSpacecraftOperatorPlugin(): GamePlugin {
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
    simulation: ({ controlPlugins }) =>
      createSpacecraftVehicleDynamicsPlugin(controlPlugins),
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
