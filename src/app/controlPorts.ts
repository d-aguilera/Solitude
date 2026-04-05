export const BASE_CONTROL_ACTIONS = [
  "rollLeft",
  "rollRight",
  "pitchUp",
  "pitchDown",
  "yawLeft",
  "yawRight",
  "lookLeft",
  "lookRight",
  "lookUp",
  "lookDown",
  "lookReset",
  "camForward",
  "camBackward",
  "camUp",
  "camDown",
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

export const ALL_ENV_ACTIONS = [
  "decreaseTimeScale",
  "increaseTimeScale",
  "pauseToggle",
  "profilingToggle",
] as const;

export type BaseControlAction = (typeof BASE_CONTROL_ACTIONS)[number];
export type ControlAction = string;
export type ControlInput = Record<string, boolean> &
  Record<BaseControlAction, boolean>;

export type EnvAction = (typeof ALL_ENV_ACTIONS)[number];
export type EnvInput = Record<EnvAction, boolean>;

export function createControlInput(
  extraActions: readonly string[] = [],
): ControlInput {
  const result: Record<string, boolean> = {};
  for (const action of BASE_CONTROL_ACTIONS) {
    result[action] = false;
  }
  for (const action of extraActions) {
    result[action] = false;
  }
  return result as ControlInput;
}
