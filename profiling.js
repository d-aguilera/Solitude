import { keys } from "./input.js";
import { paused } from "./pause.js";

const profileEveryMs = 3000;

let pKeyDown = false;
let lastProfileStartMs = 0;
let doProfile = false;
let counters;

export let enabled = false;

export function check() {
  enabledControl();

  if (!enabled || paused) return;

  const now = performance.now();
  if (now - lastProfileStartMs < profileEveryMs) {
    return;
  }

  lastProfileStartMs = now;
  doProfile = true;
  counters = {};
}

export function profile(counterGroup, counterName, fn) {
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
  const duration = entries[entries.length - 1].duration;

  add(counterGroup, counterName, duration);

  // Optional: clear marks/measures if you want to avoid buildup
  performance.clearMarks(markStart);
  performance.clearMarks(markEnd);
  performance.clearMeasures(measureName);

  return result;
}

export function add(counterGroup, counterName, value) {
  if (!doProfile) return;

  const group = (counters[counterGroup] ??= {});
  group[counterName] ??= 0;
  group[counterName] += value;
}

export function flush() {
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

function enabledControl() {
  if (keys.KeyP) {
    if (!pKeyDown) {
      enabled = !enabled;
      pKeyDown = true;
    }
  } else {
    if (pKeyDown) {
      pKeyDown = false;
    }
  }
}
