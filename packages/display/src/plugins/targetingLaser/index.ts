import type { GamePlugin } from "@solitude/engine/plugin";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { createTargetingLaserController } from "./core";

const targetingLaserToggleAction = "targetingLaserToggle";

export function createTargetingLaserPlugin(): GamePlugin {
  const controller = createTargetingLaserController();
  return {
    id: "targetingLaser",
    capabilities: [
      createKeyboardInputProvider({
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
