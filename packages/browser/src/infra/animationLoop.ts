export interface AnimationLoopState {
  readonly running: boolean;
  readonly animationFrameTimeMs: number;
}

/** A retained handle does not retain the frame callback after disposal. */
export function startAnimationLoop(
  update: (nowMs: number, dtMillis: number, state: AnimationLoopState) => void,
  onError: (error: unknown) => void,
): { dispose: () => void } {
  let callback: typeof update | null = update;
  let errorHandler: typeof onError | null = onError;
  let requestId: number | null = null;
  let previousTime: number | null = null;
  let animationFrameTimeMs = 0;
  const state: AnimationLoopState = {
    get running() {
      return callback !== null;
    },
    get animationFrameTimeMs() {
      return animationFrameTimeMs;
    },
  };
  const dispose = () => {
    callback = null;
    errorHandler = null;
    if (requestId !== null) cancelAnimationFrame(requestId);
    requestId = null;
  };
  const frame = (frameTimeMs: number) => {
    requestId = null;
    if (!callback) return;
    animationFrameTimeMs = frameTimeMs;
    // The supplied frame timestamp can lag callback execution, then catch up
    // on the next callback. Use one actual monotonic clock for every loop stage.
    const nowMs = performance.now();
    const previous = previousTime;
    previousTime = nowMs;
    try {
      if (previous !== null) callback(nowMs, nowMs - previous, state);
    } catch (error) {
      const report = errorHandler;
      dispose();
      report?.(error);
      return;
    }
    if (state.running) requestId = requestAnimationFrame(frame);
  };
  requestId = requestAnimationFrame(frame);
  return { dispose };
}
