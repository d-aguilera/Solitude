import type { ExternalPluginCapabilityProvider } from "./capabilities";

export type ExternalControlAction = string;
export type ExternalControlInput = Record<ExternalControlAction, boolean>;

export interface ExternalKeyHandler {
  handleKeyDown: (action: ExternalControlAction, isRepeat: boolean) => boolean;
  handleKeyUp: (action: ExternalControlAction) => boolean;
}

export interface ExternalKeyboardInputProvider {
  actions?: readonly ExternalControlAction[];
  keyMap?: Readonly<Record<string, ExternalControlAction>>;
  createKeyHandler?: (controlInput: ExternalControlInput) => ExternalKeyHandler;
}

export const keyboardInputCapability = "solitude.keyboardInput.v1";

export function createKeyboardInputCapability(
  provider: ExternalKeyboardInputProvider,
): ExternalPluginCapabilityProvider {
  return { id: keyboardInputCapability, value: provider };
}
