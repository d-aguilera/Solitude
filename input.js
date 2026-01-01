export const keys = {
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
  KeyP: false,
  Space: false,
};

export function init() {
  window.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
  });

  window.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
  });
}
