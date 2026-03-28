export const ALL_CONTROL_ACTIONS = [
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
  "alignToBody",
  "alignToVelocity",
  "circleNow",
] as const;

export const ALL_ENV_ACTIONS = [
  "decreaseTimeScale",
  "increaseTimeScale",
  "pauseToggle",
  "profilingToggle",
] as const;

export type ControlAction = (typeof ALL_CONTROL_ACTIONS)[number];
export type ControlInput = Record<ControlAction, boolean>;

export type EnvAction = (typeof ALL_ENV_ACTIONS)[number];
export type EnvInput = Record<EnvAction, boolean>;
