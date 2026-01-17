import { ProfilerController } from "../app/appPorts";
import { Profiler } from "../domain/domainPorts";

const profileEveryMs = 3000;

let doProfile = false;
let enabled = false;
let lastProfileStartMs = 0;
let paused = false;

let counters: Record<string, Record<string, number>> = {};

/**
 * Default profiling adapter.
 *
 * Implements both measurement and control contracts so that
 * inner layers can depend on Profiler while outer layers manage it
 * through ProfilerController.
 */
export class DefaultProfiler implements Profiler, ProfilerController {
  run<T>(group: string, name: string, fn: () => T): T {
    if (!doProfile) {
      return fn();
    }

    const markStart = `${group}:${name}:start`;
    const markEnd = `${group}:${name}:end`;
    const measureName = `${group}:${name}`;

    performance.mark(markStart);
    const result = fn();
    performance.mark(markEnd);

    performance.measure(measureName, markStart, markEnd);
    const entries = performance.getEntriesByName(measureName);
    const duration = entries[entries.length - 1]!.duration;

    this.increment(group, name, duration);

    performance.clearMarks(markStart);
    performance.clearMarks(markEnd);
    performance.clearMeasures(measureName);

    return result;
  }

  increment(group: string, name: string, count?: number): void {
    if (!doProfile) return;

    const group2 = (counters[group] ??= {});
    group2[name] ??= 0;
    group2[name] += count ?? 1;
  }

  // ProfilerController

  setEnabled(value: boolean): void {
    enabled = value;
  }

  isEnabled(): boolean {
    return enabled;
  }

  setPaused(isPaused: boolean): void {
    paused = isPaused;
  }

  check(): void {
    if (!enabled || paused) return;

    const now = performance.now();
    if (now - lastProfileStartMs < profileEveryMs) {
      return;
    }

    lastProfileStartMs = now;
    doProfile = true;
    counters = {};
  }

  flush(): void {
    if (!doProfile) return;

    for (const group of Object.keys(counters)) {
      console.log(
        "".concat(
          "[",
          group,
          "] ",
          Object.entries(counters[group])
            .map(
              ([name, value]) => `${name}=${Math.round(value * 1000) / 1000}`,
            )
            .join(", "),
        ),
      );
    }

    doProfile = false;
  }
}
