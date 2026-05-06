import type { ControlAction } from "@solitude/engine/app/controlPorts";
import type { InputPlugin } from "@solitude/engine/app/pluginPorts";

const spacecraftActions = [
  "rollLeft",
  "rollRight",
  "pitchUp",
  "pitchDown",
  "yawLeft",
  "yawRight",
  "burnForward",
  "burnBackwards",
  "burnLeft",
  "burnRight",
  "thrust0",
  "thrust1",
  "thrust2",
  "thrust3",
  "thrust4",
  "thrust5",
  "thrust6",
  "thrust7",
  "thrust8",
  "thrust9",
] as const;

const spacecraftKeyMap: Record<string, ControlAction> = {
  Digit0: "thrust0",
  Digit1: "thrust1",
  Digit2: "thrust2",
  Digit3: "thrust3",
  Digit4: "thrust4",
  Digit5: "thrust5",
  Digit6: "thrust6",
  Digit7: "thrust7",
  Digit8: "thrust8",
  Digit9: "thrust9",
  KeyA: "yawLeft",
  KeyB: "burnBackwards",
  KeyD: "yawRight",
  KeyE: "rollRight",
  KeyM: "burnRight",
  KeyN: "burnLeft",
  KeyQ: "rollLeft",
  KeyS: "pitchDown",
  KeyW: "pitchUp",
  Space: "burnForward",
};

export function createInputPlugin(): InputPlugin {
  return {
    actions: spacecraftActions,
    keyMap: spacecraftKeyMap,
  };
}
