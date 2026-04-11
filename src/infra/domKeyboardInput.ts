import type {
  ControlAction,
  ControlInput,
  EnvAction,
  EnvInput,
} from "../app/controlPorts";
import { ALL_ENV_ACTIONS, createControlInput } from "../app/controlPorts";
import type { GamePlugin, InputPlugin, KeyHandler } from "../app/pluginPorts";

/**
 * Initialize keyboard listeners and keep the actions state updated.
 */
export function initInput(plugins: GamePlugin[] = []): {
  controlInput: ControlInput;
  envInput: EnvInput;
} {
  const envInput = makeDefaultEnvInput();
  const inputPlugins = collectInputPlugins(plugins);
  const pluginActions = collectControlActions(inputPlugins);
  const controlInput = createControlInput(pluginActions);
  const keyHandlers = collectKeyHandlers(inputPlugins, controlInput, envInput);
  const keyMap = buildKeyMap(inputPlugins);

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    const action = keyMap[e.code];
    if (!action) return;
    for (const handler of keyHandlers) {
      if (handler.handleKeyDown(action, e.repeat)) {
        return;
      }
    }
    updateInputs(controlInput, envInput, action, true);
  });

  window.addEventListener("keyup", (e: KeyboardEvent) => {
    const action = keyMap[e.code];
    if (!action) return;
    for (const handler of keyHandlers) {
      if (handler.handleKeyUp(action)) {
        return;
      }
    }
    updateInputs(controlInput, envInput, action, false);
  });

  return { controlInput, envInput };
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

const baseKeyMap: Record<string, ControlAction | EnvAction> = {
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
  KeyD: "yawRight",
  KeyE: "rollRight",
  KeyI: "camUp",
  KeyJ: "camBackward",
  KeyK: "camDown",
  KeyM: "burnRight",
  KeyN: "burnLeft",
  KeyO: "profilingToggle",
  KeyQ: "rollLeft",
  KeyR: "lookReset",
  KeyS: "pitchDown",
  KeyU: "camForward",
  KeyW: "pitchUp",
  Space: "burnForward",
};

function collectInputPlugins(plugins: GamePlugin[]): InputPlugin[] {
  const inputPlugins: InputPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.input) {
      inputPlugins.push(plugin.input);
    }
  }
  return inputPlugins;
}

function collectControlActions(plugins: InputPlugin[]): string[] {
  const envActions = new Set<EnvAction>(ALL_ENV_ACTIONS);
  const actions = new Set<string>();
  for (const plugin of plugins) {
    if (plugin.actions) {
      for (const action of plugin.actions) {
        if (!envActions.has(action as EnvAction)) {
          actions.add(action);
        }
      }
    }
    if (plugin.keyMap) {
      for (const action of Object.values(plugin.keyMap)) {
        if (!envActions.has(action as EnvAction)) {
          actions.add(action);
        }
      }
    }
  }
  return Array.from(actions);
}

function collectKeyHandlers(
  plugins: InputPlugin[],
  controlInput: ControlInput,
  envInput: EnvInput,
): KeyHandler[] {
  const handlers: KeyHandler[] = [];
  for (const plugin of plugins) {
    const handler = plugin.createKeyHandler?.(controlInput, envInput);
    if (handler) {
      handlers.push(handler);
    }
  }
  return handlers;
}

function buildKeyMap(
  plugins: InputPlugin[],
): Record<string, ControlAction | EnvAction> {
  const keyMap: Record<string, ControlAction | EnvAction> = { ...baseKeyMap };
  for (const plugin of plugins) {
    if (!plugin.keyMap) continue;
    for (const [key, action] of Object.entries(plugin.keyMap)) {
      keyMap[key] = action;
    }
  }
  return keyMap;
}
