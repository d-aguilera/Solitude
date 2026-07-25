import type {
  ExternalLoopPlugin,
  ExternalLoopUpdateResult,
} from "@solitude/plugin-api/loop";
import { createPauseController } from "./logic";

const PAUSED_LOOP_UPDATE: ExternalLoopUpdateResult = {
  framePolicy: {
    advanceSim: false,
    advanceScene: false,
    advancePresentation: true,
  },
};

export function createLoopPlugin(): {
  loop: ExternalLoopPlugin;
  controller: ReturnType<typeof createPauseController>;
} {
  const controller = createPauseController();

  const loop: ExternalLoopPlugin = {
    initLoop: () => {
      controller.init();
    },
    updateLoopState: (params) => {
      const paused = controller.updatePaused(params.controlInput.pauseToggle);
      // An earlier fixed-tick diagnostic loop already owns the frame policy.
      if (params.state.framePolicy.tickDtMillis !== undefined) return null;
      return paused ? PAUSED_LOOP_UPDATE : null;
    },
  };

  return { loop, controller };
}
