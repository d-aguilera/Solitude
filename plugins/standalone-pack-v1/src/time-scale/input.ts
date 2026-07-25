import type { ExternalKeyboardInputProvider } from "@solitude/plugin-api/input";

export function createInputPlugin(): ExternalKeyboardInputProvider {
  return {
    actions: ["decreaseTimeScale", "increaseTimeScale"],
    keyMap: {
      BracketLeft: "decreaseTimeScale",
      BracketRight: "increaseTimeScale",
    },
  };
}
