/**
 * Measurement-only profiling interface.
 */
export interface Profiler {
  /**
   * Time a function and register its duration in an implementation-defined way.
   */
  run: <T>(group: string, name: string, fn: () => T) => T;

  /**
   * Increment a counter in the given group.
   */
  increment: (group: string, name: string, count?: number) => void;
}
