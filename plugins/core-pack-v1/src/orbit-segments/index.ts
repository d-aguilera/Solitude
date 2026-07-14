import { createKeyboardInputCapability } from "@solitude/plugin-api/input";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
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
    hooks: { segments: controller.segments },
  };
}
