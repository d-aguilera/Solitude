import type { ControlAction, ControlInput } from "../app/controlPorts";
import { BASE_CONTROL_ACTIONS, createControlInput } from "../app/controlPorts";
import type { GamePlugin, InputPlugin, KeyHandler } from "../app/pluginPorts";

/**
 * Initialize keyboard listeners and keep the actions state updated.
 */
export function initInput(plugins: GamePlugin[] = []): {
  controlInput: ControlInput;
} {
  const inputPlugins = collectInputPlugins(plugins);
  const pluginActions = collectControlActions(inputPlugins);
  const controlInput = createControlInput(pluginActions);
  const keyHandlers = collectKeyHandlers(inputPlugins, controlInput);
  const keyMap = buildKeyMap(inputPlugins);

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    const action = keyMap[e.code];
    if (!action) return;
    for (const handler of keyHandlers) {
      if (handler.handleKeyDown(action, e.repeat)) {
        return;
      }
    }
    updateInputs(controlInput, action, true);
  });

  window.addEventListener("keyup", (e: KeyboardEvent) => {
    const action = keyMap[e.code];
    if (!action) return;
    for (const handler of keyHandlers) {
      if (handler.handleKeyUp(action)) {
        return;
      }
    }
    updateInputs(controlInput, action, false);
  });

  return { controlInput };
}

function updateInputs(
  controlInput: ControlInput,
  action: ControlAction,
  isDown: boolean,
) {
  if (action in controlInput) {
    controlInput[action as ControlAction] = isDown;
  }
}

const baseKeyMap: Record<string, ControlAction> = {
  ArrowDown: "lookDown",
  ArrowLeft: "lookLeft",
  ArrowRight: "lookRight",
  ArrowUp: "lookUp",
  KeyI: "camUp",
  KeyJ: "camBackward",
  KeyK: "camDown",
  KeyR: "lookReset",
  KeyU: "camForward",
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
  const envActions = new Set<ControlAction>(BASE_CONTROL_ACTIONS);
  const actions = new Set<string>();
  for (const plugin of plugins) {
    if (plugin.actions) {
      for (const action of plugin.actions) {
        if (!envActions.has(action)) {
          actions.add(action);
        }
      }
    }
    if (plugin.keyMap) {
      for (const action of Object.values(plugin.keyMap)) {
        if (!envActions.has(action)) {
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
): KeyHandler[] {
  const handlers: KeyHandler[] = [];
  for (let i = plugins.length - 1; i >= 0; i--) {
    const plugin = plugins[i];
    const handler = plugin.createKeyHandler?.(controlInput);
    if (handler) {
      handlers.push(handler);
    }
  }
  return handlers;
}

function buildKeyMap(plugins: InputPlugin[]): Record<string, ControlAction> {
  const keyMap: Record<string, ControlAction> = { ...baseKeyMap };
  for (const plugin of plugins) {
    if (!plugin.keyMap) continue;
    for (const [key, action] of Object.entries(plugin.keyMap)) {
      keyMap[key] = action;
    }
  }
  return keyMap;
}

export const __domKeyboardInputTest = {
  buildKeyMap,
  collectControlActions,
};
