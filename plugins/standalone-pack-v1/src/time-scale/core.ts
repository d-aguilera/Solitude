import type {
  ExternalLoopPlugin,
  ExternalLoopUpdateResult,
} from "@solitude/plugin-api/loop";
import { createTimeScaleController } from "./logic";

const DEFAULT_TIME_SCALE = 1;

export function createLoopPlugin(): {
  plugin: ExternalLoopPlugin;
  controller: ReturnType<typeof createTimeScaleController>;
} {
  const controller = createTimeScaleController(DEFAULT_TIME_SCALE);
  const framePolicy = { simDtMillis: 0 };
  const updateResult: ExternalLoopUpdateResult = { framePolicy };

  const plugin: ExternalLoopPlugin = {
    updateLoopState: (params) => {
      const nextTimeScale = controller.update(
        params.controlInput.decreaseTimeScale,
        params.controlInput.increaseTimeScale,
      );
      // An earlier fixed-tick diagnostic loop already owns simulation timing.
      if (params.state.framePolicy.tickDtMillis !== undefined) return null;
      framePolicy.simDtMillis = params.dtMillis * nextTimeScale;
      return updateResult;
    },
  };

  return { plugin, controller };
}
