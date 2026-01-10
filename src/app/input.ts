type KeyCode =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Digit0"
  | "KeyW"
  | "KeyA"
  | "KeyS"
  | "KeyD"
  | "KeyQ"
  | "KeyE"
  | "KeyO"
  | "KeyP"
  | "Space"
  | "KeyB"
  | "AltLeft"
  | "AltRight"
  | "ShiftLeft"
  | "ShiftRight";

type KeyState = Record<KeyCode, boolean>;

export const keys: KeyState = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Digit0: false,
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  KeyQ: false,
  KeyE: false,
  KeyO: false,
  KeyP: false,
  Space: false,
  KeyB: false,
  AltLeft: false,
  AltRight: false,
  ShiftLeft: false,
  ShiftRight: false,
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
