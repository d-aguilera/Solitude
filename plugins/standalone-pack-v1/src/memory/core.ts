import type { ExternalLoopPlugin } from "@solitude/plugin-api/loop";
import { createMemoryTelemetryController } from "./logic";

export function createLoopPlugin(): {
  plugin: ExternalLoopPlugin;
  controller: ReturnType<typeof createMemoryTelemetryController>;
} {
  const controller = createMemoryTelemetryController();

  const plugin: ExternalLoopPlugin = {
    updateLoopState: (params) => {
      controller.updateEnabled(params.controlInput.profilingToggle);
      controller.update(params.nowMs);
      return null;
    },
  };

  return { plugin, controller };
}
