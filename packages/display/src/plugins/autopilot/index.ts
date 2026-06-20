import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { readLocaleRuntimeOption } from "@solitude/localization";
import { createAutopilotBehaviorPlugin } from "@solitude/sim/autopilot/behavior";
import { createInputPlugin as createAutopilotInputPlugin } from "@solitude/sim/autopilot/input";
import { createHudPanel } from "./hud";
import { createAutopilotLocalization } from "./localization";

export function createAutopilotPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const behavior = createAutopilotBehaviorPlugin(runtimeOptions);
  const localization = createAutopilotLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    ...behavior,
    capabilities: [
      ...(behavior.capabilities ?? []),
      createHudPanelProvider(createHudPanel(localization)),
      createKeyboardInputProvider(createAutopilotInputPlugin()),
    ],
  };
}
