let lastFpsUpdateMs = 0;
let nextCheck = 0;
let framesThisSecond = 0;

export let fps = 0;

export function updateFPS(nowMs: number): void {
  if (lastFpsUpdateMs === 0) {
    lastFpsUpdateMs = nowMs;
    nextCheck = lastFpsUpdateMs + 1000;
    return;
  }

  framesThisSecond++;

  if (nowMs < nextCheck) return;

  fps = (1000 * framesThisSecond) / (nowMs - lastFpsUpdateMs);
  framesThisSecond = 0;
  lastFpsUpdateMs = nowMs;
  nextCheck = lastFpsUpdateMs + 1000;
}
