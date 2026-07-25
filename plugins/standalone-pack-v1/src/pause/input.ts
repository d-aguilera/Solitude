import type { ExternalKeyboardInputProvider } from "@solitude/plugin-api/input";

export function createInputPlugin(): ExternalKeyboardInputProvider {
  return {
    actions: ["pauseToggle"],
    keyMap: {
      KeyP: "pauseToggle",
    },
  };
}
