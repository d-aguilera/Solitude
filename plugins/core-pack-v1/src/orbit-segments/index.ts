import { createKeyboardInputCapability } from "@solitude/plugin-api/capabilities";
import type {
  ExternalPlugin,
  ExternalRuntimeOptions,
} from "@solitude/plugin-api/plugin";
import { createOrbitSegmentsController } from "./core";

const orbitSegmentsToggleAction = "orbitSegmentsToggle";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const controller = createOrbitSegmentsController();
  return {
    id: "orbitSegments",
    capabilities: [
      createKeyboardInputCapability({
        actions: [orbitSegmentsToggleAction],
        keyMap: { KeyG: orbitSegmentsToggleAction },
        createKeyHandler: () => ({
          handleKeyDown: (action, isRepeat) => {
            if (action !== orbitSegmentsToggleAction) return false;
            if (!isRepeat) controller.requestToggle();
            return true;
          },
          handleKeyUp: (action) => action === orbitSegmentsToggleAction,
        }),
      }),
    ],
    requirements: {
      mainFocus: ["controlledBody", "motionState"],
    },
    segments: controller.segments,
  };
}
