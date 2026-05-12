/**
 * Measurement-only profiling interface.
 */
export interface Profiler {
  /**
   * Begin a measurement section.
   *
   * Returns true when profiling is actively collecting this frame; callers may
   * skip the matching end call when false.
   */
  begin: (group: string, name: string) => boolean;

  /**
   * End a measurement section started with begin.
   */
  end: (group: string, name: string) => void;

  /**
   * Time a function and register its duration in an implementation-defined way.
   */
  run: <T>(group: string, name: string, fn: () => T) => T;

  /**
   * Increment a counter in the given group.
   */
  increment: (group: string, name: string, count?: number) => void;
}

/**
 * Control-side profiling interface.
 */
export interface ProfilerController {
  /**
   * Enable or disable profiling globally.
   */
  setEnabled(value: boolean): void;

  /**
   * Signal paused/unpaused application state so profilers can suspend work.
   */
  setPaused(isPaused: boolean): void;

  /**
   * Advance any internal profiling window, if enabled.
   */
  check(): void;

  /**
   * Flush accumulated counters and timing data, if enabled.
   */
  flush(): void;
}
