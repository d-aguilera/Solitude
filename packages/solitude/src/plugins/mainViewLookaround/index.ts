import type { GamePlugin } from "@solitude/engine/plugin";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { createViewControlPlugin } from "./core";
import { createInputPlugin } from "./input";

export function createMainViewLookaroundPlugin(): GamePlugin {
  return {
    id: "mainViewLookaround",
    capabilities: [createKeyboardInputProvider(createInputPlugin())],
    viewControls: createViewControlPlugin(),
  };
}
