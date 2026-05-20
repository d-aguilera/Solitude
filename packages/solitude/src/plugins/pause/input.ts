import type { InputPlugin } from "@solitude/engine/plugin";

export function createInputPlugin(): InputPlugin {
  return {
    actions: ["pauseToggle"],
    keyMap: {
      KeyP: "pauseToggle",
    },
  };
}
