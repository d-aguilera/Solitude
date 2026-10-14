import type { ControlInput, GamePlugin } from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import {
  collectKeyboardInputProviders,
  createKeyboardHandlerDispatcher,
  type KeyboardHandlerDispatcher,
} from "@solitude/input/keyboard";
import { createDisposalScope } from "./disposal";

export interface BrowserKeyboardInput {
  readonly controlInput: ControlInput;
  clear: () => void;
  dispose: () => void;
}

export interface BrowserKeyboardHost {
  attach: (dispatcher: KeyboardHandlerDispatcher) => BrowserKeyboardInput;
  dispose: () => void;
}

/** Shell-owned physical-key tracking survives detaching/replacing a runtime. */
export function createBrowserKeyboardHost(): BrowserKeyboardHost {
  const scope = createDisposalScope();
  const held = new Set<string>();
  const suppressed = new Set<string>();
  let active: KeyboardHandlerDispatcher | null = null;
  const clear = () => {
    for (const code of held) suppressed.add(code);
    active?.clear();
  };
  const keyDown = (event: KeyboardEvent) => {
    // Let native buttons activate with Space/Enter without issuing flight input.
    // Keep the matching release suppressed too, so its default click survives.
    if (
      (event.code === "Space" || event.code === "Enter") &&
      (event.target as HTMLElement | null)?.tagName === "BUTTON" &&
      !held.has(event.code)
    )
      suppressed.add(event.code);
    // Repeats without a known press can arrive after focus loss or startup.
    if (event.repeat && !held.has(event.code)) suppressed.add(event.code);
    held.add(event.code);
    if (suppressed.has(event.code)) return;
    if (active?.handleKey(event.code, true, event.repeat))
      event.preventDefault();
  };
  const keyUp = (event: KeyboardEvent) => {
    held.delete(event.code);
    if (suppressed.delete(event.code)) return;
    if (active?.handleKey(event.code, false, event.repeat))
      event.preventDefault();
  };
  const visibilityChange = () => {
    if (document.visibilityState === "hidden") clear();
  };
  const dispose = () => {
    if (scope.disposed) return;
    try {
      clear();
    } finally {
      active = null;
      held.clear();
      suppressed.clear();
      scope.dispose();
    }
  };
  try {
    window.addEventListener("keydown", keyDown);
    scope.add(() => window.removeEventListener("keydown", keyDown));
    window.addEventListener("keyup", keyUp);
    scope.add(() => window.removeEventListener("keyup", keyUp));
    window.addEventListener("blur", clear);
    scope.add(() => window.removeEventListener("blur", clear));
    document.addEventListener("visibilitychange", visibilityChange);
    scope.add(() =>
      document.removeEventListener("visibilitychange", visibilityChange),
    );
    window.addEventListener("pagehide", dispose);
    scope.add(() => window.removeEventListener("pagehide", dispose));
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    dispose,
    attach: (dispatcher) => {
      if (scope.disposed) throw new Error("Keyboard host is disposed");
      if (active)
        throw new Error("Keyboard host already has an active runtime");
      for (const code of held) suppressed.add(code);
      active = dispatcher;
      let binding: KeyboardHandlerDispatcher | null = dispatcher;
      return {
        controlInput: dispatcher.controlInput,
        clear: () => {
          if (binding && active === binding) clear();
        },
        dispose: () => {
          if (!binding) return;
          try {
            if (active === binding) clear();
          } finally {
            if (active === binding) active = null;
            binding = null;
          }
        },
      };
    },
  };
}

export function initInput(
  plugins: GamePlugin[],
  host: BrowserKeyboardHost,
): BrowserKeyboardInput {
  return host.attach(createInputDispatcher(plugins));
}

/** Construct input before pipeline validation, attach only after it succeeds. */
export function createInputDispatcher(
  plugins: GamePlugin[],
): KeyboardHandlerDispatcher {
  const providers = collectKeyboardInputProviders(
    createPluginCapabilityRegistry(plugins),
  );
  return createKeyboardHandlerDispatcher(providers);
}
