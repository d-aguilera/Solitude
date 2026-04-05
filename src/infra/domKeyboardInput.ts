import type {
  ControlAction,
  ControlInput,
  EnvAction,
  EnvInput,
} from "../app/controlPorts.js";
import { ALL_CONTROL_ACTIONS, ALL_ENV_ACTIONS } from "../app/controlPorts.js";

/**
 * Initialize keyboard listeners and keep the actions state updated.
 */
export function initInput(): {
  controlInput: ControlInput;
  envInput: EnvInput;
} {
  const controlInput = makeDefaultControlInput();
  const envInput = makeDefaultEnvInput();
  let pendingAutopilotRelease: ControlAction | null = null;

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code in keyMap) {
      const action = keyMap[e.code];
      if (isAutopilotToggle(action)) {
        if (!e.repeat) {
          if (controlInput[action]) {
            pendingAutopilotRelease = action;
          } else {
            activateAutopilot(controlInput, action);
            pendingAutopilotRelease = null;
          }
        }
        return;
      }
      updateInputs(controlInput, envInput, action, true);
    }
  });

  window.addEventListener("keyup", (e: KeyboardEvent) => {
    if (e.code in keyMap) {
      const action = keyMap[e.code];
      if (isAutopilotToggle(action)) {
        if (pendingAutopilotRelease === action) {
          clearAutopilot(controlInput);
          pendingAutopilotRelease = null;
        }
        return;
      }
      updateInputs(controlInput, envInput, action, false);
    }
  });

  return { controlInput, envInput };
}

const autopilotToggleActions: Set<ControlAction> = new Set([
  "alignToBody",
  "alignToVelocity",
  "circleNow",
]);

function isAutopilotToggle(
  action: ControlAction | EnvAction,
): action is ControlAction {
  return autopilotToggleActions.has(action as ControlAction);
}

function clearAutopilot(controlInput: ControlInput): void {
  controlInput.alignToBody = false;
  controlInput.alignToVelocity = false;
  controlInput.circleNow = false;
}

function activateAutopilot(
  controlInput: ControlInput,
  action: ControlAction,
): void {
  clearAutopilot(controlInput);
  controlInput[action] = true;
}

function makeDefaultControlInput(): ControlInput {
  const result: Partial<ControlInput> = {};
  for (const action of ALL_CONTROL_ACTIONS) {
    result[action] = false;
  }
  return result as ControlInput;
}

function makeDefaultEnvInput(): EnvInput {
  const result: Partial<EnvInput> = {};
  for (const action of ALL_ENV_ACTIONS) {
    result[action] = false;
  }
  return result as EnvInput;
}

function updateInputs(
  controlInput: ControlInput,
  envInput: EnvInput,
  action: ControlAction | EnvAction,
  isDown: boolean,
) {
  if (action in controlInput) {
    controlInput[action as ControlAction] = isDown;
  }
  if (action in envInput) {
    envInput[action as EnvAction] = isDown;
  }
}

const keyMap: Record<string, ControlAction | EnvAction> = {
  ArrowDown: "lookDown",
  ArrowLeft: "lookLeft",
  ArrowRight: "lookRight",
  ArrowUp: "lookUp",
  BracketLeft: "decreaseTimeScale",
  BracketRight: "increaseTimeScale",
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
  KeyC: "alignToBody",
  KeyD: "yawRight",
  KeyE: "rollRight",
  KeyI: "camUp",
  KeyJ: "camBackward",
  KeyK: "camDown",
  KeyM: "burnRight",
  KeyN: "burnLeft",
  KeyO: "profilingToggle",
  KeyP: "pauseToggle",
  KeyQ: "rollLeft",
  KeyR: "lookReset",
  KeyS: "pitchDown",
  KeyU: "camForward",
  KeyV: "alignToVelocity",
  KeyW: "pitchUp",
  KeyX: "circleNow",
  Space: "burnForward",
};
