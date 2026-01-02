import {
  ControlInput,
  updatePhysics,
  updatePlaneAxesSpherical,
  type FlightState,
} from "./controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import { init as initInput, getKeyState } from "./input.js";
import { pauseControl, paused } from "./pause.js";
import {
  isProfilingEnabled,
  profile,
  profileCheck,
  profileFlush,
  setPausedForProfiling,
  setProfilingEnabled,
} from "./profilingFacade.js";
import { renderPilotView, renderTopView, renderHUD } from "./renderer.js";
import { airplanes, pilot, plane, topCamera } from "./setup.js";

let lastTimeMs = 0;
let pKeyDown = false;

// Single source of truth for the mutable flight state during the game loop.
// This is built from the existing setup.ts singletons, but the physics code
// no longer depends on those globals directly.
const flightState: FlightState = {
  plane,
  pilot,
  mainAirplane: airplanes[0],
};

function makeControlInput(): ControlInput {
  const keys = getKeyState();

  return {
    rollLeft: keys.KeyA,
    rollRight: keys.KeyD,
    pitchUp: keys.KeyW,
    pitchDown: keys.KeyS,
    yawLeft: keys.KeyQ,
    yawRight: keys.KeyE,
    lookLeft: keys.ArrowLeft,
    lookRight: keys.ArrowRight,
    lookUp: keys.ArrowUp,
    lookDown: keys.ArrowDown,
    resetView: keys.Digit0,
    pause: keys.Space,
    toggleProfiling: keys.KeyP,
  };
}

export function startGame(
  ctxPilot: CanvasRenderingContext2D,
  ctxTop: CanvasRenderingContext2D
): void {
  initInput();
  updatePlaneAxesSpherical(flightState);
  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
  });
}

function handleProfilingToggle(input: ControlInput): void {
  if (input.toggleProfiling) {
    if (!pKeyDown) {
      const current = getProfilingEnabledFromEnv();
      const next = !current;
      setProfilingEnabled(next);
      setProfilingEnabledInEnv(next);
      pKeyDown = true;
    }
  } else if (pKeyDown) {
    pKeyDown = false;
  }
}

function renderFrame(
  ctxPilot: CanvasRenderingContext2D,
  ctxTop: CanvasRenderingContext2D,
  nowMs: number
): void {
  const dtMs = nowMs - lastTimeMs;
  lastTimeMs = nowMs;

  const dtSeconds = paused ? 0 : dtMs / 1000;

  const input = makeControlInput();

  pauseControl(input.pause);
  handleProfilingToggle(input);

  setPausedForProfiling(paused);
  profileCheck();

  profile("GAME", "total", () => {
    updateFPS(nowMs);

    profile("GAME", "physics", () => {
      updatePhysics(dtSeconds, input, flightState);
    });

    profile("GAME", "pilot-view", () => {
      renderPilotView(ctxPilot, {
        plane: flightState.plane,
        pilot: flightState.pilot,
        airplanes,
      });
    });

    profile("GAME", "top-view", () => {
      renderTopView(ctxTop, {
        plane: flightState.plane,
        topCamera,
        airplanes,
      });
    });

    profile("GAME", "hud", () => {
      renderHUD(ctxTop, flightState.plane, isProfilingEnabled());
    });
  });

  profileFlush();

  requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
}
