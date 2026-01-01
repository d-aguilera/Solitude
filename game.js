import { updateTopCamera } from "./cameraSystem.js";
import { updatePhysics } from "./controls.js";
import { updateFPS } from "./fps.js";
import { init as initInput } from "./input.js";
import { pauseControl, paused } from "./pause.js";
import {
  profile,
  check as profileCheck,
  flush as profileFlush,
} from "./profiling.js";
import { renderPilotView, renderTopView, renderHUD } from "./renderer.js";
import { ground, cubes } from "./setup.js";
import { getVisibleObjects } from "./visibility.js";

let lastTimeMs = 0;

export function startGame(ctxPilot, ctxTop) {
  initInput();
  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
  });
}

function renderFrame(ctxPilot, ctxTop, nowMs) {
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

    profile("GAME", "top-camera", () => {
      updateTopCamera(cubes);
    });

    const visibleGround = profile("GAME", "visible-ground", () =>
      getVisibleObjects(ground)
    );

    profile("GAME", "pilot-view", () => {
      renderPilotView(visibleGround, ctxPilot);
    });

    profile("GAME", "top-view", () => {
      renderTopView(visibleGround, ctxTop);
    });

    profile("GAME", "hud", () => {
      renderHUD(ctxTop);
    });
  });

  profileFlush();

  requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
}
