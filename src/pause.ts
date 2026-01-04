let pauseKeyDown = false;
let pausing = false;

export let paused = false;

export function pauseControl(pauseKeyPressed: boolean): void {
  if (pauseKeyPressed) {
    if (!pauseKeyDown) {
      if (!paused) {
        pausing = true;
        paused = true;
      }
      pauseKeyDown = true;
    }
  } else {
    if (pauseKeyDown) {
      if (pausing) {
        pausing = false;
      } else {
        paused = false;
      }
      pauseKeyDown = false;
    }
  }
}
