import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createAutopilotBehaviorPlugin } from "../../autopilot/behavior";

export function createAutopilotPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  return createAutopilotBehaviorPlugin(runtimeOptions);
}
