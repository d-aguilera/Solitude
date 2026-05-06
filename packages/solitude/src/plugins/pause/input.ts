import type { InputPlugin } from "@solitude/engine/app/pluginPorts";

export function createInputPlugin(): InputPlugin {
  return {
    actions: ["pauseToggle"],
    keyMap: {
      KeyP: "pauseToggle",
    },
  };
}
