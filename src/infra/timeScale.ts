let prevDecreaseKeyDown = false;
let prevIncreaseKeyDown = false;

export function handleTimeScaleChange(
  decreaseKeyDown: boolean,
  increaseKeyDown: boolean,
  currentTimeScale: number,
): number {
  let newTimeScale = currentTimeScale;

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
}
