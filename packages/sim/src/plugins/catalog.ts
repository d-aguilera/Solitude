import type { PluginCatalog } from "@solitude/engine/plugin";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";

export const simPluginCatalog: PluginCatalog = {
  spacecraftOperator: createSpacecraftOperatorPlugin,
};
