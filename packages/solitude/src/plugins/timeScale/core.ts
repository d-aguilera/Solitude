import type {
  LoopPlugin,
  LoopUpdateResult,
} from "@solitude/engine/app/pluginPorts";
import { parameters } from "@solitude/engine/global/parameters";
import { createTimeScaleController } from "./logic";

export function createLoopPlugin(): {
  plugin: LoopPlugin;
  controller: ReturnType<typeof createTimeScaleController>;
} {
  const controller = createTimeScaleController(parameters.timeScale);
  const framePolicy = { simDtMillis: 0 };
  const updateResult: LoopUpdateResult = { framePolicy };

  const plugin: LoopPlugin = {
    updateLoopState: (params) => {
      const nextTimeScale = controller.update(
        params.controlInput.decreaseTimeScale,
        params.controlInput.increaseTimeScale,
      );
      framePolicy.simDtMillis = params.dtMillis * nextTimeScale;
      return updateResult;
    },
  };

  return { plugin, controller };
}
