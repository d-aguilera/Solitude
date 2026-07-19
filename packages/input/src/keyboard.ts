import type {
  ControlAction,
  ControlInput,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";

export const keyboardInputCapability = "solitude.keyboardInput.v1";

export interface KeyHandler {
  handleKeyDown: (action: ControlAction, isRepeat: boolean) => boolean;
  handleKeyUp: (action: ControlAction) => boolean;
}

export interface KeyboardInputContext {
  unlockedActions: ReadonlySet<ControlAction>;
}

export interface KeyboardInputProvider {
  actions?: readonly ControlAction[];
  keyMap?: Readonly<Record<string, ControlAction>>;
  unlockedActions?: readonly ControlAction[];
  createKeyHandler?: (
    controlInput: ControlInput,
    context: KeyboardInputContext,
  ) => KeyHandler;
}

export interface KeyboardHandlerDispatcher {
  readonly controlInput: ControlInput;
  handleKey: (code: string, isDown: boolean, isRepeat: boolean) => boolean;
}

/** Dispatches provider-owned key handlers, then updates plain held actions. */
export function createKeyboardHandlerDispatcher(
  providers: readonly KeyboardInputProvider[],
): KeyboardHandlerDispatcher {
  const actions = new Set<ControlAction>();
  const unlockedActions = new Set<ControlAction>();
  const keyMap: Record<string, ControlAction> = {};
  for (const provider of providers) {
    for (const action of provider.actions ?? []) actions.add(action);
    for (const action of provider.unlockedActions ?? []) {
      unlockedActions.add(action);
    }
    for (const [code, action] of Object.entries(provider.keyMap ?? {})) {
      actions.add(action);
      keyMap[code] = action;
    }
  }
  const controlInput: ControlInput = {};
  for (const action of actions) controlInput[action] = false;
  const context: KeyboardInputContext = { unlockedActions };
  const handlers = providers
    .map((provider) => provider.createKeyHandler?.(controlInput, context))
    .filter((handler): handler is KeyHandler => handler !== undefined)
    .reverse();

  return {
    controlInput,
    handleKey: (code, isDown, isRepeat) => {
      const action = keyMap[code];
      if (!action) return false;
      for (const handler of handlers) {
        const handled = isDown
          ? handler.handleKeyDown(action, isRepeat)
          : handler.handleKeyUp(action);
        if (handled) return true;
      }
      controlInput[action] = isDown;
      return true;
    },
  };
}

export function createKeyboardInputProvider(
  provider: KeyboardInputProvider,
): PluginCapabilityProvider {
  return { id: keyboardInputCapability, value: provider };
}

export function collectKeyboardInputProviders(
  source: PluginCapabilityRegistry | readonly PluginCapabilityProvider[],
): KeyboardInputProvider[] {
  const values = isCapabilityProviderArray(source)
    ? source
        .filter((capability) => capability.id === keyboardInputCapability)
        .map((capability) => capability.value)
    : source.getAll(keyboardInputCapability);
  return values.filter(isKeyboardInputProvider);
}

function isCapabilityProviderArray(
  source: PluginCapabilityRegistry | readonly PluginCapabilityProvider[],
): source is readonly PluginCapabilityProvider[] {
  return Array.isArray(source);
}

function isKeyboardInputProvider(
  value: unknown,
): value is KeyboardInputProvider {
  return typeof value === "object" && value !== null;
}
