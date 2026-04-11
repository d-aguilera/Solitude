import type { InputPlugin } from "../../app/pluginPorts";

export function createInputPlugin(): InputPlugin {
  return {
    actions: ["profilingToggle"],
    keyMap: {
      KeyO: "profilingToggle",
    },
  };
}
