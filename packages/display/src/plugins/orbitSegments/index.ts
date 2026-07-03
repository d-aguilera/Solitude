import type { GamePlugin } from "@solitude/engine/plugin";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { createOrbitSegmentsController } from "./core";

const orbitSegmentsToggleAction = "orbitSegmentsToggle";

export function createOrbitSegmentsPlugin(): GamePlugin {
  const controller = createOrbitSegmentsController();
  return {
    id: "orbitSegments",
    capabilities: [
      createKeyboardInputProvider({
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
