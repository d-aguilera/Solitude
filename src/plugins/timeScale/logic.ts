export interface TimeScaleController {
  update: (decreaseKeyDown: boolean, increaseKeyDown: boolean) => number;
  getScale: () => number;
}

export function createTimeScaleController(
  initialScale: number,
): TimeScaleController {
  let prevDecreaseKeyDown = false;
  let prevIncreaseKeyDown = false;
  let currentScale = initialScale;

  const update = (
    decreaseKeyDown: boolean,
    increaseKeyDown: boolean,
  ): number => {
    let newTimeScale = currentScale;

    if (increaseKeyDown) {
      if (!prevIncreaseKeyDown) {
        newTimeScale *= 2.0;
        prevIncreaseKeyDown = true;
      }
    } else {
      if (prevIncreaseKeyDown) {
        prevIncreaseKeyDown = false;
      }
    }

    if (decreaseKeyDown) {
      if (!prevDecreaseKeyDown) {
        newTimeScale /= 2.0;
        if (newTimeScale < 1.0) newTimeScale = 1.0;
        prevDecreaseKeyDown = true;
      }
    } else {
      if (prevDecreaseKeyDown) {
        prevDecreaseKeyDown = false;
      }
    }

    return newTimeScale;
  };

  const getScale = (): number => currentScale;

  const updateAndStore = (
    decreaseKeyDown: boolean,
    increaseKeyDown: boolean,
  ): number => {
    const next = update(decreaseKeyDown, increaseKeyDown);
    currentScale = next;
    return next;
  };

  return { update: updateAndStore, getScale };
}
