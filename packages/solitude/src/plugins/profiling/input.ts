import type { InputPlugin } from "@solitude/engine/plugin";

export function createInputPlugin(): InputPlugin {
  return {
    actions: ["profilingToggle"],
    keyMap: {
      KeyO: "profilingToggle",
    },
  };
}
