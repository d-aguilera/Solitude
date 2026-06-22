import type {
  ControlAction,
  ControlInput,
  PluginCapabilityProvider,
} from "@solitude/engine/plugin";

export const keyboardInputCapability = "solitude.keyboardInput.v1";

export interface KeyHandler {
  handleKeyDown: (action: ControlAction, isRepeat: boolean) => boolean;
  handleKeyUp: (action: ControlAction) => boolean;
}

export interface KeyboardInputProvider {
  actions?: readonly ControlAction[];
  keyMap?: Readonly<Record<string, ControlAction>>;
  createKeyHandler?: (controlInput: ControlInput) => KeyHandler;
}

export interface KeyboardHandlerDispatcher {
  handleKey: (code: string, isDown: boolean, isRepeat: boolean) => boolean;
}

/** Dispatches only provider-owned key handlers; unhandled actions remain local. */
export function createKeyboardHandlerDispatcher(
  providers: readonly KeyboardInputProvider[],
): KeyboardHandlerDispatcher {
  const actions = new Set<ControlAction>();
  const keyMap: Record<string, ControlAction> = {};
  for (const provider of providers) {
    for (const action of provider.actions ?? []) actions.add(action);
    for (const [code, action] of Object.entries(provider.keyMap ?? {})) {
      actions.add(action);
      keyMap[code] = action;
    }
  }
  const controlInput: ControlInput = {};
  for (const action of actions) controlInput[action] = false;
  const handlers = providers
    .map((provider) => provider.createKeyHandler?.(controlInput))
    .filter((handler): handler is KeyHandler => handler !== undefined)
    .reverse();

  return {
    handleKey: (code, isDown, isRepeat) => {
      const action = keyMap[code];
      if (!action) return false;
      for (const handler of handlers) {
        const handled = isDown
          ? handler.handleKeyDown(action, isRepeat)
          : handler.handleKeyUp(action);
        if (handled) return true;
      }
      return false;
    },
  };
}

export function createKeyboardInputProvider(
  provider: KeyboardInputProvider,
): PluginCapabilityProvider {
  return { id: keyboardInputCapability, value: provider };
}

export function collectKeyboardInputProviders(
  capabilities: readonly PluginCapabilityProvider[],
): KeyboardInputProvider[] {
  return capabilities
    .filter((capability) => capability.id === keyboardInputCapability)
    .map((capability) => capability.value)
    .filter(isKeyboardInputProvider);
}

function isKeyboardInputProvider(
  value: unknown,
): value is KeyboardInputProvider {
  return typeof value === "object" && value !== null;
}
