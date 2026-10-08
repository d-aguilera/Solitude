export interface AnimationLoopState {
  readonly running: boolean;
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
  const state: AnimationLoopState = {
    get running() {
      return callback !== null;
    },
  };
  const dispose = () => {
    callback = null;
    errorHandler = null;
    if (requestId !== null) cancelAnimationFrame(requestId);
    requestId = null;
  };
  const frame = (nowMs: number) => {
    requestId = null;
    if (!callback) return;
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
