let spaceKeyDown = false;
let pausing = false;

export let paused = false;

export function pauseControl(spacePressed: boolean): void {
  if (spacePressed) {
    if (!spaceKeyDown) {
      if (!paused) {
        pausing = true;
        paused = true;
      }
      spaceKeyDown = true;
    }
  } else {
    if (spaceKeyDown) {
      if (pausing) {
        pausing = false;
      } else {
        paused = false;
      }
      spaceKeyDown = false;
    }
  }
}
