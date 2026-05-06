import type { InputPlugin } from "@solitude/engine/app/pluginPorts";

export function createInputPlugin(): InputPlugin {
  return {
    actions: ["profilingToggle"],
    keyMap: {
      KeyO: "profilingToggle",
    },
  };
}
