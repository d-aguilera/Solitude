import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { readLocaleRuntimeOption } from "../../localization";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createAutopilotLocalization } from "./localization";

export function createAutopilotPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const localization = createAutopilotLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "autopilot",
    capabilities: [
      createAutonomousControlProvider(),
      createPropulsionResolverProvider(),
      createHudPanelProvider(createHudPanel(localization)),
    ],
    input: createInputPlugin(),
    controls: createControlPlugin(),
    requirements: {
      mainFocus: [
        "controlledBody",
        "motionState",
        "localFrame",
        "angularVelocity",
      ],
    },
  };
}
