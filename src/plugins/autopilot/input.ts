import type {
  ControlAction,
  ControlInput,
  EnvAction,
  EnvInput,
} from "../../app/controlPorts.js";
import type { InputPlugin, KeyHandler } from "../../app/pluginPorts.js";

const autopilotToggleActions: Set<ControlAction> = new Set([
  "alignToBody",
  "alignToVelocity",
  "circleNow",
]);

const autopilotKeyMap: Record<string, ControlAction> = {
  KeyC: "alignToBody",
  KeyV: "alignToVelocity",
  KeyX: "circleNow",
};

export function createInputPlugin(): InputPlugin {
  return {
    keyMap: autopilotKeyMap,
    createKeyHandler: (controlInput: ControlInput, _envInput: EnvInput) => {
      void _envInput;
      return createKeyHandler(controlInput);
    },
  };
}

function createKeyHandler(controlInput: ControlInput): KeyHandler {
  let pendingAutopilotRelease: ControlAction | null = null;

  const handleKeyDown = (
    action: ControlAction | EnvAction,
    isRepeat: boolean,
  ): boolean => {
    if (!isAutopilotToggle(action)) return false;
    if (!isRepeat) {
      if (controlInput[action]) {
        pendingAutopilotRelease = action;
      } else {
        activateAutopilot(controlInput, action);
        pendingAutopilotRelease = null;
      }
    }
    return true;
  };

  const handleKeyUp = (action: ControlAction | EnvAction): boolean => {
    if (!isAutopilotToggle(action)) return false;
    if (pendingAutopilotRelease === action) {
      clearAutopilot(controlInput);
      pendingAutopilotRelease = null;
    }
    return true;
  };

  return { handleKeyDown, handleKeyUp };
}

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
