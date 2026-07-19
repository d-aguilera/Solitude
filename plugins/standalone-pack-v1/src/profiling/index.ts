import { createHudPanelCapability } from "@solitude/plugin-api/hud";
import { createKeyboardInputCapability } from "@solitude/plugin-api/input";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type {
  ExternalPlugin,
  ExternalPluginContext,
} from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createProfilingLocalization } from "./localization";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
  context: ExternalPluginContext,
): ExternalPlugin {
  const { plugin, controller } = createLoopPlugin(context.profiler);
  const localization = createProfilingLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "profiling",
    capabilities: [
      createHudPanelCapability(createHudPanel(controller, localization)),
      createKeyboardInputCapability(createInputPlugin()),
    ],
    hooks: { loop: plugin },
  };
}
