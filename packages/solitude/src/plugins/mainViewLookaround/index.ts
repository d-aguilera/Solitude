import type { GamePlugin } from "@solitude/engine/plugin";
import { createViewControlPlugin } from "./core";
import { createInputPlugin } from "./input";

export function createMainViewLookaroundPlugin(): GamePlugin {
  return {
    id: "mainViewLookaround",
    input: createInputPlugin(),
    viewControls: createViewControlPlugin(),
  };
}
