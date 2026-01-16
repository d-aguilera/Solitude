/**
 * Small abstraction for profiling / tracing.
 *
 * Implementations can be provided in any layer; this type is shared
 * so that app and render can depend on it without depending on
 * a concrete profiling module.
 */
export type Profiler = {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
};
