import type { KeyboardInputProvider } from "@solitude/input/keyboard";

export function createInputPlugin(): KeyboardInputProvider {
  return {
    actions: ["pauseToggle"],
    keyMap: {
      KeyP: "pauseToggle",
    },
  };
}
