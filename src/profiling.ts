const profileEveryMs = 3000;

let lastProfileStartMs = 0;
let doProfile = false;
let counters: Record<string, Record<string, number>> = {};

let enabled = false;
let pausedThisFrame = false;

export function setProfilingEnabled(value: boolean): void {
  enabled = value;
}

export function isProfilingEnabled(): boolean {
  return enabled;
}

export function setPausedForProfiling(isPaused: boolean): void {
  pausedThisFrame = isPaused;
}

export function check(): void {
  if (!enabled || pausedThisFrame) return;

  const now = performance.now();
  if (now - lastProfileStartMs < profileEveryMs) {
    return;
  }

  lastProfileStartMs = now;
  doProfile = true;
  counters = {};
}

export function profile<T>(
  counterGroup: string,
  counterName: string,
  fn: () => T
): T {
  if (!doProfile) {
    return fn();
  }

  const markStart = `${counterGroup}:${counterName}:start`;
  const markEnd = `${counterGroup}:${counterName}:end`;
  const measureName = `${counterGroup}:${counterName}`;

  performance.mark(markStart);
  const result = fn();
  performance.mark(markEnd);

  performance.measure(measureName, markStart, markEnd);
  const entries = performance.getEntriesByName(measureName);
  const duration = entries[entries.length - 1]!.duration;

  add(counterGroup, counterName, duration);

  performance.clearMarks(markStart);
  performance.clearMarks(markEnd);
  performance.clearMeasures(measureName);

  return result;
}

export function add(
  counterGroup: string,
  counterName: string,
  value: number
): void {
  if (!doProfile) return;

  const group = (counters[counterGroup] ??= {});
  group[counterName] ??= 0;
  group[counterName] += value;
}

export function flush(): void {
  if (!doProfile) return;

  for (const group of Object.keys(counters)) {
    console.log(
      "".concat(
        "[",
        group,
        "] ",
        Object.entries(counters[group])
          .map(([name, value]) => ({
            name,
            value,
            isCount: name.endsWith("count") || name.endsWith("Count"),
          }))
          .map(
            (x) =>
              `${x.name}=${
                x.isCount ? x.value : Math.round(x.value * 1000) / 1000
              }${x.isCount ? "" : "ms"}`
          )
          .join(", ")
      )
    );
  }

  doProfile = false;
}
