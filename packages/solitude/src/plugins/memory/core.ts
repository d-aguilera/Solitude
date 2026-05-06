import type { LoopPlugin } from "@solitude/engine/app/pluginPorts";
import { createMemoryTelemetryController } from "./logic";

export function createLoopPlugin(): {
  plugin: LoopPlugin;
  controller: ReturnType<typeof createMemoryTelemetryController>;
} {
  const controller = createMemoryTelemetryController();

  const plugin: LoopPlugin = {
    updateLoopState: (params) => {
      controller.updateEnabled(params.controlInput.profilingToggle);
      controller.update(params.nowMs);
      return null;
    },
  };

  return { plugin, controller };
}
