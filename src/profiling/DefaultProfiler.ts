import { add as realAdd } from "./profiling.js";
import { profile } from "./profilingFacade.js";
import type { Profiler } from "./profilingPorts.js";

export class DefaultProfiler implements Profiler {
  run<T>(group: string, name: string, fn: () => T): T {
    return profile(group, name, fn);
  }

  increment(group: string, name: string, count?: number): void {
    realAdd(group, name, count ?? 1);
  }
}
