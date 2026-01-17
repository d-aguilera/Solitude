/**
 * Small abstraction for profiling / tracing.
 */
export interface Profiler {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
}
