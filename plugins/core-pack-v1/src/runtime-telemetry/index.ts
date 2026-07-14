import { createHudPanelCapability } from "@solitude/plugin-api/hud";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import { createPresentationFrameCapability } from "@solitude/plugin-api/presentation";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
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
