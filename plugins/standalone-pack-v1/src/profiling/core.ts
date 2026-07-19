import type { ExternalLoopPlugin } from "@solitude/plugin-api/loop";
import type { ExternalProfilerControl } from "@solitude/plugin-api/profiling";
import { createProfilingController } from "./logic";

export function createLoopPlugin(profiler: ExternalProfilerControl): {
  plugin: ExternalLoopPlugin;
  controller: ReturnType<typeof createProfilingController>;
} {
  const controller = createProfilingController();

  const plugin: ExternalLoopPlugin = {
    updateLoopState: (params) => {
      const enabled = controller.updateEnabled(
        params.controlInput.profilingToggle,
      );
      profiler.setEnabled(enabled);
      profiler.setPaused(!params.state.framePolicy.advanceSim);
      profiler.check();
      return null;
    },
    afterFrame: () => {
      profiler.flush();
    },
  };

  return { plugin, controller };
}
