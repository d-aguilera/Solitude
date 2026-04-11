import type { LoopPlugin } from "../../app/pluginPorts";
import { createPauseController } from "./logic";

export function createLoopPlugin(): {
  loop: LoopPlugin;
  controller: ReturnType<typeof createPauseController>;
} {
  const controller = createPauseController();

  const loop: LoopPlugin = {
    initLoop: () => {
      controller.init();
    },
    updateLoopState: ({ controlInput }) => {
      const paused = controller.updatePaused(controlInput.pauseToggle);
      return {
        framePolicy: {
          advanceSim: !paused,
          advanceScene: !paused,
          advanceHud: true,
        },
      };
    },
  };

  return { loop, controller };
}
