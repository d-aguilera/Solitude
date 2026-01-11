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
  | "KeyW"
  | "Space";

type KeyState = Record<KeyCode, boolean>;

export const keys: KeyState = {
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
  KeyW: false,
  Space: false,
};

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

export function getKeyState(): Readonly<KeyState> {
  return keys;
}
