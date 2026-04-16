import type { LoopPlugin } from "../../app/pluginPorts";
import { createMemoryTelemetryController } from "./logic";

export function createLoopPlugin(): {
  plugin: LoopPlugin;
  controller: ReturnType<typeof createMemoryTelemetryController>;
} {
  const controller = createMemoryTelemetryController();

  const plugin: LoopPlugin = {
    updateLoopState: ({ controlInput, nowMs }) => {
      controller.updateEnabled(controlInput.profilingToggle);
      controller.update(nowMs);
      return null;
    },
  };

  return { plugin, controller };
}
