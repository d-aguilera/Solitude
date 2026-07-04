import type { ControlInput, GamePlugin } from "@solitude/engine/plugin";
import {
  collectKeyboardInputProviders,
  createKeyboardHandlerDispatcher,
} from "@solitude/input/keyboard";

/**
 * Initialize keyboard listeners and keep the actions state updated.
 */
export function initInput(plugins: GamePlugin[] = []): {
  controlInput: ControlInput;
} {
  const inputPlugins = collectKeyboardInputProviders(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );
  const dispatcher = createKeyboardHandlerDispatcher(inputPlugins);

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (dispatcher.handleKey(e.code, true, e.repeat)) {
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e: KeyboardEvent) => {
    if (dispatcher.handleKey(e.code, false, e.repeat)) {
      e.preventDefault();
    }
  });

  return { controlInput: dispatcher.controlInput };
}
