import { createPlugin as createFeature } from "../operator-switch";
import { selectSandboxPlugin } from "./runSelection";

export const createPlugin = selectSandboxPlugin(
  "operatorSwitch",
  createFeature,
);
