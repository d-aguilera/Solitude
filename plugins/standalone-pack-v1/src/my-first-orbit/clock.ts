/** Retained frame policy. Readiness frames never establish a flight baseline. */
export function createSessionClock(initiallyReady: boolean) {
  let ready = initiallyReady;
  let startupLastNow: number | null = null;
  let startupStableMillis = 0;
  let lastNow: number | null = null;
  return {
    get ready() {
      return ready;
    },
    resetStartup: () => {
      startupLastNow = null;
      startupStableMillis = 0;
    },
    rebase: () => {
      lastNow = null;
    },
    observeStartupFrame: (
      now: number,
      dt: number,
      canFly: boolean,
    ): boolean => {
      if (ready) return false;
      const elapsed = startupLastNow === null ? 0 : now - startupLastNow;
      const timely =
        canFly &&
        Number.isFinite(now) &&
        Number.isFinite(dt) &&
        dt > 0 &&
        dt <= 250 &&
        elapsed > 0 &&
        elapsed <= 250;
      startupStableMillis = timely ? startupStableMillis + elapsed : 0;
      startupLastNow = Number.isFinite(now) ? now : null;
      if (startupStableMillis < 500) return false;
      ready = true;
      return true;
    },
    updateFrame: (now: number, dt: number): "hold" | "advance" | "suspend" => {
      if (
        !Number.isFinite(now) ||
        !Number.isFinite(dt) ||
        dt < 0 ||
        (lastNow !== null && now < lastNow)
      )
        return "suspend";
      if (lastNow === null) {
        lastNow = now;
        return "hold";
      }
      const elapsed = now - lastNow;
      if (elapsed > 250 || dt > 250) return "suspend";
      lastNow = now;
      return elapsed > 0 && dt > 0 ? "advance" : "hold";
    },
  };
}
