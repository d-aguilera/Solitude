import {
  createKeyboardInputCapability,
  type ExternalPlugin,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import { createTargetingLaserController } from "./core";

const targetingLaserToggleAction = "targetingLaserToggle";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const controller = createTargetingLaserController();
  return {
    id: "targetingLaser",
    capabilities: [
      createKeyboardInputCapability({
        actions: [targetingLaserToggleAction],
        keyMap: { KeyT: targetingLaserToggleAction },
        createKeyHandler: () => ({
          handleKeyDown: (action, isRepeat) => {
            if (action !== targetingLaserToggleAction) return false;
            if (!isRepeat) controller.requestToggle();
            return true;
          },
          handleKeyUp: (action) => action === targetingLaserToggleAction,
        }),
      }),
    ],
    markers: controller.markers,
    requirements: {
      mainFocus: ["controlledBody", "motionState", "localFrame"],
    },
    segments: controller.segments,
  };
}
