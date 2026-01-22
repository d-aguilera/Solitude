import type { ControlInput, EnvInput } from "./appPorts.js";

type KeyCode =
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "Digit0"
  | "Digit1"
  | "Digit2"
  | "Digit3"
  | "Digit4"
  | "Digit5"
  | "Digit6"
  | "KeyA"
  | "KeyB"
  | "KeyD"
  | "KeyE"
  | "KeyI"
  | "KeyJ"
  | "KeyK"
  | "KeyO"
  | "KeyP"
  | "KeyQ"
  | "KeyR"
  | "KeyS"
  | "KeyU"
  | "KeyV"
  | "KeyW"
  | "Space";

type KeyState = Record<KeyCode, boolean>;

/**
 * Process-level key state cache. Updated by DOM event listeners.
 */
const keys: KeyState = {
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  Digit0: false,
  Digit1: false,
  Digit2: false,
  Digit3: false,
  Digit4: false,
  Digit5: false,
  Digit6: false,
  KeyA: false,
  KeyB: false,
  KeyD: false,
  KeyE: false,
  KeyI: false,
  KeyJ: false,
  KeyK: false,
  KeyO: false,
  KeyP: false,
  KeyQ: false,
  KeyR: false,
  KeyS: false,
  KeyU: false,
  KeyV: false,
  KeyW: false,
  Space: false,
};

/**
 * Initialize keyboard listeners and keep the internal key state updated.
 */
export function init(): void {
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    const code = e.code as KeyCode;
    if (code in keys) keys[code] = true;
  });

  window.addEventListener("keyup", (e: KeyboardEvent) => {
    const code = e.code as KeyCode;
    if (code in keys) keys[code] = false;
  });
}

/**
 * Snapshot of the current low-level key state.
 */
function getKeyState(): Readonly<KeyState> {
  return keys;
}

/**
 * Map low-level key state into semantic ship/camera controls.
 */
export function readControlInput(): ControlInput {
  const state = getKeyState();

  return {
    burnBackwards: state.KeyB,
    burnForward: state.Space,
    camForward: state.KeyU,
    camBackward: state.KeyJ,
    camUp: state.KeyI,
    camDown: state.KeyK,
    lookDown: state.ArrowDown,
    lookLeft: state.ArrowLeft,
    lookRight: state.ArrowRight,
    lookUp: state.ArrowUp,
    lookReset: state.KeyR,
    pitchDown: state.KeyS,
    pitchUp: state.KeyW,
    rollLeft: state.KeyA,
    rollRight: state.KeyD,
    thrust0: state.Digit0,
    thrust1: state.Digit1,
    thrust2: state.Digit2,
    thrust3: state.Digit3,
    thrust4: state.Digit4,
    thrust5: state.Digit5,
    thrust6: state.Digit6,
    yawLeft: state.KeyQ,
    yawRight: state.KeyE,
    alignToVelocity: state.KeyV,
  };
}

/**
 * Map low-level key state into environment-level controls.
 */
export function readEnvInput(): EnvInput {
  const state = getKeyState();

  return {
    pauseToggle: state.KeyP,
    profilingToggle: state.KeyO,
  };
}
