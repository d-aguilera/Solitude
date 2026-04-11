import type { InputPlugin } from "../../app/pluginPorts";

export function createInputPlugin(): InputPlugin {
  return {
    actions: ["pauseToggle"],
    keyMap: {
      KeyP: "pauseToggle",
    },
  };
}
