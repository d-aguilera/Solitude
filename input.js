const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  KeyQ: false,
  KeyE: false,
  Space: false,
};

window.addEventListener("keydown", (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
  if (e.key === "0") {
    pilot.azimuth = 0;
    pilot.elevation = 0;
  }
});
window.addEventListener("keyup", (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});
