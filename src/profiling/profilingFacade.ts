import {
  check as realCheck,
  flush as realFlush,
  isProfilingEnabled as realIsProfilingEnabled,
  profile as realProfile,
  setProfilingEnabled as realSetProfilingEnabled,
  setPausedForProfiling as realSetPausedForProfiling,
} from "./profiling.js";

/**
 * Wrapper that decouples callers from the concrete profiling implementation.
 * If profiling is disabled, just runs fn() without any overhead or dependency
 * on the real profiler.
 */
export function profile<T>(
  counterGroup: string,
  counterName: string,
  fn: () => T,
): T {
  return realIsProfilingEnabled()
    ? realProfile(counterGroup, counterName, fn)
    : fn();
}

export function isProfilingEnabled(): boolean {
  return realIsProfilingEnabled();
}

export function setProfilingEnabled(value: boolean): void {
  realSetProfilingEnabled(value);
}

export function setPausedForProfiling(isPaused: boolean): void {
  realSetPausedForProfiling(isPaused);
}

export function profileCheck(): void {
  realCheck();
}

export function profileFlush(): void {
  realFlush();
}
