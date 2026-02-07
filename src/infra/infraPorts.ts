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
