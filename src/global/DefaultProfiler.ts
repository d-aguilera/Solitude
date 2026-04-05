import type { ProfilerController } from "../infra/infraPorts";
import type { Profiler } from "./globalPorts";

/**
 * Implements both measurement and control contracts.
 */
export class DefaultProfiler implements Profiler, ProfilerController {
  // Profiler implementation

  private counters: Record<string, Record<string, number>> = {};

  run<T>(group: string, name: string, fn: () => T): T {
    if (!this.doProfile) {
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
    if (!this.doProfile) return;

    const counters = this.counters;
    const countOrOne = count ?? 1;

    const g: Record<string, number> | undefined = counters[group];

    if (!g) {
      counters[group] = { [name]: countOrOne };
      return;
    }

    if (name in g) {
      g[name] += countOrOne;
    } else {
      g[name] = countOrOne;
    }
  }

  // ProfilerController implementation

  private readonly profileEveryMs = 3000;
  private doProfile = false;
  private enabled = false;
  private paused = false;
  private lastProfileStartMs = 0;

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  setPaused(isPaused: boolean): void {
    this.paused = isPaused;
  }

  check(): void {
    if (!this.enabled || this.paused) return;

    const now = performance.now();
    if (now - this.lastProfileStartMs < this.profileEveryMs) {
      return;
    }

    this.lastProfileStartMs = now;
    this.doProfile = true;
    this.counters = {};
  }

  flush(): void {
    if (!this.doProfile) return;

    for (const group of Object.keys(this.counters)) {
      console.log(
        "".concat(
          "[",
          group,
          "] ",
          Object.entries(this.counters[group])
            .map(
              ([name, value]) => `${name}=${Math.round(value * 1000) / 1000}`,
            )
            .join(", "),
        ),
      );
    }

    this.doProfile = false;
  }
}
