let paused = false;
let pauseKeyDown = false;
let pausing = false;

export function handlePauseToggle(pauseKeyPressed: boolean): boolean {
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

  return paused;
}
