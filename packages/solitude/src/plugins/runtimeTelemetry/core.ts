import type { LoopPlugin } from "@solitude/engine/app/pluginPorts";
import { createRuntimeTelemetryController } from "./logic";

export function createLoopPlugin(): {
  plugin: LoopPlugin;
  controller: ReturnType<typeof createRuntimeTelemetryController>;
} {
  const controller = createRuntimeTelemetryController();

  const plugin: LoopPlugin = {
    updateLoopState: ({ dtMillis }) => {
      controller.updateFps(dtMillis);
      return null;
    },
  };

  return { plugin, controller };
}
