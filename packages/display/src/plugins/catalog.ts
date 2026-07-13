import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotHudPlugin } from "./autopilot/index";

export const displayPluginCatalog: PluginCatalog = {
  autopilotHud: createAutopilotHudPlugin,
};
