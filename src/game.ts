import { updatePhysics, updatePlaneAxesSpherical } from "./controls.js";
import { updateFPS } from "./fps.js";
import { init as initInput } from "./input.js";
import { pauseControl, paused } from "./pause.js";
import {
  profile,
  check as profileCheck,
  flush as profileFlush,
} from "./profiling.js";
import { renderPilotView, renderTopView, renderHUD } from "./renderer.js";

let lastTimeMs = 0;

export function startGame(
  ctxPilot: CanvasRenderingContext2D,
  ctxTop: CanvasRenderingContext2D
): void {
  initInput();

  updatePlaneAxesSpherical();

  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
  });
}

function renderFrame(
  ctxPilot: CanvasRenderingContext2D,
  ctxTop: CanvasRenderingContext2D,
  nowMs: number
): void {
  const dtMs = nowMs - lastTimeMs;
  lastTimeMs = nowMs;

  const dtSeconds = paused ? 0 : dtMs / 1000;

  profileCheck();

  profile("GAME", "total", () => {
    updateFPS(nowMs);
    pauseControl();

    profile("GAME", "physics", () => {
      updatePhysics(dtSeconds);
    });

    profile("GAME", "pilot-view", () => {
      renderPilotView(ctxPilot);
    });

    profile("GAME", "top-view", () => {
      renderTopView(ctxTop);
    });

    profile("GAME", "hud", () => {
      renderHUD(ctxTop);
    });
  });

  profileFlush();

  requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
}
