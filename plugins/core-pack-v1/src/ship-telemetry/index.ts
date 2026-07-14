import { createHudPanelCapability } from "@solitude/plugin-api/hud";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createHudPanel } from "./hud";
import { createShipTelemetryLocalization } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const localization = createShipTelemetryLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "shipTelemetry",
    capabilities: [createHudPanelCapability(createHudPanel(localization))],
  };
}
