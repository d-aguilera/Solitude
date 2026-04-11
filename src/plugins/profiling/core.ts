import type { LoopPlugin } from "../../app/pluginPorts";
import { profilerController } from "../../global/profiling";
import { createProfilingController } from "./logic";

export function createLoopPlugin(): {
  plugin: LoopPlugin;
  controller: ReturnType<typeof createProfilingController>;
} {
  const controller = createProfilingController();

  const plugin: LoopPlugin = {
    updateLoopState: ({ controlInput, state }) => {
      const enabled = controller.updateEnabled(controlInput.profilingToggle);
      profilerController.setEnabled(enabled);
      profilerController.setPaused(!state.framePolicy.advanceSim);
      profilerController.check();
      return null;
    },
    afterFrame: () => {
      profilerController.flush();
    },
  };

  return { plugin, controller };
}
