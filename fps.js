let lastFpsUpdateMs = 0;
let framesThisSecond = 0;

export let fps = 0;

export function updateFPS(nowMs) {
  if (lastFpsUpdateMs === 0) {
    lastFpsUpdateMs = nowMs;
    return;
  }
  framesThisSecond++;
  if (nowMs - lastFpsUpdateMs >= 1000) {
    fps = framesThisSecond / ((nowMs - lastFpsUpdateMs) / 1000);
    framesThisSecond = 0;
    lastFpsUpdateMs = nowMs;
  }
}
