import type { InputPlugin } from "@solitude/engine/plugin";

export const mainViewLookaroundActions = [
  "lookLeft",
  "lookRight",
  "lookUp",
  "lookDown",
  "lookReset",
  "camForward",
  "camBackward",
  "camUp",
  "camDown",
] as const;

export function createInputPlugin(): InputPlugin {
  return {
    actions: mainViewLookaroundActions,
    keyMap: {
      ArrowDown: "lookDown",
      ArrowLeft: "lookLeft",
      ArrowRight: "lookRight",
      ArrowUp: "lookUp",
      KeyI: "camUp",
      KeyJ: "camBackward",
      KeyK: "camDown",
      KeyR: "lookReset",
      KeyU: "camForward",
    },
  };
}
