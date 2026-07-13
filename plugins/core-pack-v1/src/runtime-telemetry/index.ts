import {
  createHudPanelCapability,
  createPresentationFrameCapability,
  readLocaleRuntimeOption,
  type ExternalPlugin,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import { createHudPanel } from "./hud";
import { createRuntimeTelemetryLocalization } from "./localization";
import { createRuntimeTelemetryController } from "./logic";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const controller = createRuntimeTelemetryController();
  const localization = createRuntimeTelemetryLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "runtimeTelemetry",
    capabilities: [
      createHudPanelCapability(createHudPanel(controller, localization)),
      createPresentationFrameCapability({
        updatePresentationFrame: ({ dtMillis }) =>
          controller.updateFps(dtMillis),
      }),
    ],
  };
}
