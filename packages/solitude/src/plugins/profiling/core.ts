import { profilerController } from "@solitude/engine/global/profiling";
import type { LoopPlugin } from "@solitude/engine/plugin";
import { createProfilingController } from "./logic";

export function createLoopPlugin(): {
  plugin: LoopPlugin;
  controller: ReturnType<typeof createProfilingController>;
} {
  const controller = createProfilingController();

  const plugin: LoopPlugin = {
    updateLoopState: (params) => {
      const enabled = controller.updateEnabled(
        params.controlInput.profilingToggle,
      );
      profilerController.setEnabled(enabled);
      profilerController.setPaused(!params.state.framePolicy.advanceSim);
      profilerController.check();
      return null;
    },
    afterFrame: () => {
      profilerController.flush();
    },
  };

  return { plugin, controller };
}
