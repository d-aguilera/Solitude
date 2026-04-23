import type { GamePlugin, RuntimeOptions } from "../../app/pluginPorts";
import { createControlPlugin } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";
import { parseAutopilotRuntimeOptions } from "./options";

export function createAutopilotPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const options = parseAutopilotRuntimeOptions(runtimeOptions);
  if (options.warning) {
    console.warn(options.warning);
  }

  return {
    id: "autopilot",
    input: createInputPlugin(),
    controls: createControlPlugin(options.algorithmVersion),
    hud: createHudPlugin(),
  };
}
