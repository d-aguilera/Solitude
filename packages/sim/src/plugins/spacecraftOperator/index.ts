import { localFrame } from "@solitude/engine/math";
import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import type { ViewFrameUpdateParams } from "@solitude/engine/render";
import {
  createSpacecraftOperatorTelemetry,
  createSpacecraftOperatorTelemetryProvider,
} from "@solitude/hud/telemetry";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { createLocalEntityPredictionProvider } from "../../localPrediction";
import {
  createSpacecraftLocalPredictionProvider,
  createSpacecraftVehicleDynamicsPlugin,
} from "./core";
import { createInputPlugin } from "./input";

export function createSpacecraftOperatorPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  void runtimeOptions;
  const telemetry = createSpacecraftOperatorTelemetry();
  return {
    id: "spacecraftOperator",
    capabilities: [
      createSpacecraftOperatorTelemetryProvider(telemetry),
      createLocalEntityPredictionProvider(
        createSpacecraftLocalPredictionProvider(),
      ),
      createKeyboardInputProvider(createInputPlugin()),
    ],
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
