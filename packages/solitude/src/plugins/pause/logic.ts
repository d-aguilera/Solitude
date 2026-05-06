export interface PauseController {
  init: () => void;
  updatePaused: (pauseKeyPressed: boolean) => boolean;
  isPaused: () => boolean;
}

export function createPauseController(): PauseController {
  let paused = false;
  let pauseKeyDown = false;
  let pausing = false;

  const updatePaused = (pauseKeyPressed: boolean): boolean => {
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
  };

  const init = (): void => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        paused = true;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initialize once so that starting in a hidden state also pauses.
    handleVisibilityChange();
  };

  const isPaused = (): boolean => paused;

  return { init, updatePaused, isPaused };
}
