import { createKeyboardInputCapability } from "@solitude/plugin-api/input";
import { createLocalEntityPredictionProvider } from "@solitude/plugin-api/local-prediction";
import type { ExternalBrowserPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createSpacecraftOperatorTelemetryProvider } from "@solitude/plugin-api/telemetry";
import type { ExternalViewFrameUpdateParams } from "@solitude/plugin-api/views";
import {
  createSpacecraftLocalPredictionProvider,
  createSpacecraftVehicleDynamicsPlugin,
} from "./core";
import { createInputPlugin } from "./input";
import { localFrame } from "./localFrame";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions = {},
): ExternalBrowserPlugin {
  void runtimeOptions;
  const telemetry = {
    currentRcsLevel: 0,
    currentThrustLevel: 0,
  };
  return {
    id: "spacecraftOperator",
    capabilities: [
      createSpacecraftOperatorTelemetryProvider(telemetry),
      createLocalEntityPredictionProvider(
        createSpacecraftLocalPredictionProvider(),
      ),
      createKeyboardInputCapability(createInputPlugin()),
    ],
    hooks: {
      simulation: ({ capabilityRegistry, controlPlugins }) =>
        createSpacecraftVehicleDynamicsPlugin(
          controlPlugins,
          capabilityRegistry,
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
    },
  };
}

function updateSpacecraftForwardMainViewFrame({
  frame,
  mainFocus,
  mainViewLookState,
}: ExternalViewFrameUpdateParams): void {
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
