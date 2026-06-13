import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "../../hud/provider";
import {
  createSolitudeLocalization,
  readLocaleRuntimeOption,
} from "../../localization";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createAutopilotPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const localization = createSolitudeLocalization(
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
