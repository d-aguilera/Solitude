const FPS_HISTORY_CAPACITY = 300;

export interface RuntimeTelemetryController {
  getFps: () => number;
  updateFps: (dtMillis: number) => void;
}

export function createRuntimeTelemetryController(): RuntimeTelemetryController {
  const history = new Array<number>();
  let tail = -1;
  let sum = 0;
  let fps = 0;

  return {
    getFps: () => fps,
    updateFps: (dtMillis) => {
      if (dtMillis <= 0) return;

      if (history.length < FPS_HISTORY_CAPACITY) {
        tail++;
        history.push(dtMillis);
        sum += dtMillis;
      } else {
        tail = (tail + 1) % FPS_HISTORY_CAPACITY;
        sum += dtMillis - history[tail];
        history[tail] = dtMillis;
      }

      fps = 1000 / (sum / history.length);
    },
  };
}
