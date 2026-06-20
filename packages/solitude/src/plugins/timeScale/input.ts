import type { KeyboardInputProvider } from "@solitude/input/keyboard";

export function createInputPlugin(): KeyboardInputProvider {
  return {
    actions: ["decreaseTimeScale", "increaseTimeScale"],
    keyMap: {
      BracketLeft: "decreaseTimeScale",
      BracketRight: "increaseTimeScale",
    },
  };
}
