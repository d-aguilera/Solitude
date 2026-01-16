/**
 * Small adapter-facing abstraction that lets callers plug in any
 * profiling / tracing implementation without coupling to a
 * concrete API in the app or render layers.
 */
export type Profiler = {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
};
