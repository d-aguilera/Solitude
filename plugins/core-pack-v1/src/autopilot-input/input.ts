import type {
  ExternalControlAction,
  ExternalControlInput,
  ExternalKeyboardInputProvider,
  ExternalKeyHandler,
} from "@solitude/plugin-api/input";

const autopilotToggleActions: ReadonlySet<ExternalControlAction> = new Set([
  "alignToBody",
  "alignToVelocity",
  "orbit",
  "circleNow",
]);

const autopilotKeyMap: Readonly<Record<string, ExternalControlAction>> = {
  KeyC: "alignToBody",
  KeyV: "alignToVelocity",
  KeyZ: "orbit",
  KeyX: "circleNow",
};

export function createInputPlugin(): ExternalKeyboardInputProvider {
  return {
    keyMap: autopilotKeyMap,
    createKeyHandler,
  };
}

function createKeyHandler(
  controlInput: ExternalControlInput,
): ExternalKeyHandler {
  let pendingAutopilotRelease: ExternalControlAction | null = null;

  const handleKeyDown = (
    action: ExternalControlAction,
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

  const handleKeyUp = (action: ExternalControlAction): boolean => {
    if (!isAutopilotToggle(action)) return false;
    if (pendingAutopilotRelease === action) {
      clearAutopilot(controlInput);
      pendingAutopilotRelease = null;
    }
    return true;
  };

  return { handleKeyDown, handleKeyUp };
}

function isAutopilotToggle(action: ExternalControlAction): boolean {
  return autopilotToggleActions.has(action);
}

function clearAutopilot(controlInput: ExternalControlInput): void {
  controlInput.alignToBody = false;
  controlInput.alignToVelocity = false;
  controlInput.orbit = false;
  controlInput.circleNow = false;
}

function activateAutopilot(
  controlInput: ExternalControlInput,
  action: ExternalControlAction,
): void {
  clearAutopilot(controlInput);
  controlInput[action] = true;
}
