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

export function initPause(): void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      paused = true;
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Initialize once so that starting in a hidden state also pauses.
  handleVisibilityChange();
}
