import type { LoopPlugin } from "../../app/pluginPorts";
import { parameters } from "../../global/parameters";
import { createTimeScaleController } from "./logic";

export function createLoopPlugin(): {
  plugin: LoopPlugin;
  controller: ReturnType<typeof createTimeScaleController>;
} {
  const controller = createTimeScaleController(parameters.timeScale);
  const framePolicy = { simDtMillis: 0 };

  const plugin: LoopPlugin = {
    updateLoopState: ({ controlInput, dtMillis }) => {
      const nextTimeScale = controller.update(
        controlInput.decreaseTimeScale,
        controlInput.increaseTimeScale,
      );
      framePolicy.simDtMillis = dtMillis * nextTimeScale;
      return { framePolicy };
    },
  };

  return { plugin, controller };
}
