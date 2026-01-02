import { keys } from "./input.js";

let spaceKeyDown = false;
let pausing = false;

export let paused = false;

export function pauseControl(): void {
  if (keys.Space) {
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
