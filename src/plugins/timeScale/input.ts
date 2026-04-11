import type { InputPlugin } from "../../app/pluginPorts";

export function createInputPlugin(): InputPlugin {
  return {
    actions: ["decreaseTimeScale", "increaseTimeScale"],
    keyMap: {
      BracketLeft: "decreaseTimeScale",
      BracketRight: "increaseTimeScale",
    },
  };
}
