import type { ExternalKeyboardInputProvider } from "@solitude/plugin-api/input";

export function createInputPlugin(): ExternalKeyboardInputProvider {
  return {
    actions: ["profilingToggle"],
    keyMap: {
      KeyO: "profilingToggle",
    },
    unlockedActions: ["profilingToggle"],
  };
}
