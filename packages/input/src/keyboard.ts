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
