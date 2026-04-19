import type { LoopPlugin, LoopUpdateResult } from "../../app/pluginPorts";
import { createPauseController } from "./logic";

const RUNNING_LOOP_UPDATE: LoopUpdateResult = {
  framePolicy: {
    advanceSim: true,
    advanceScene: true,
    advanceHud: true,
  },
};

const PAUSED_LOOP_UPDATE: LoopUpdateResult = {
  framePolicy: {
    advanceSim: false,
    advanceScene: false,
    advanceHud: true,
  },
};

export function createLoopPlugin(): {
  loop: LoopPlugin;
  controller: ReturnType<typeof createPauseController>;
} {
  const controller = createPauseController();

  const loop: LoopPlugin = {
    initLoop: () => {
      controller.init();
    },
    updateLoopState: (params) => {
      const paused = controller.updatePaused(params.controlInput.pauseToggle);
      return paused ? PAUSED_LOOP_UPDATE : RUNNING_LOOP_UPDATE;
    },
  };

  return { loop, controller };
}
