import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "./autopilot/index";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";

export const simPluginCatalog: PluginCatalog = {
  autopilot: createAutopilotPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
};
