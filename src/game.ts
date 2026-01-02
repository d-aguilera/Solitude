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
import { vec } from "./math.js";
import { pauseControl, paused } from "./pause.js";
import { planetCenter } from "./planet.js";
import {
  isProfilingEnabled,
  profileCheck,
  profileFlush,
  setPausedForProfiling,
  setProfilingEnabled,
} from "./profilingFacade.js";
import {
  updateTopCameraFrame,
  type TopCameraFrameState,
} from "./projection.js";
import { renderPilotView, renderTopView, renderHUD } from "./renderer.js";
import { airplanes, pilot, plane, topCamera } from "./setup.js";
import { InstrumentationAdapter } from "./types.js";

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

let topCameraFrameState: TopCameraFrameState | null = null;

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
  ctxTop: CanvasRenderingContext2D,
  instrument: InstrumentationAdapter
): void {
  initInput();
  updatePlaneAxesSpherical(flightState);
  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop, instrument));
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

function updateTopCamera(dtSeconds: number): void {
  // Currently dtSeconds is unused, but keeping it here makes it easy
  // to add smoothing or lag later if desired.
  void dtSeconds;

  const plane = flightState.plane;

  const radial = vec.normalize({
    x: plane.x - planetCenter.x,
    y: plane.y - planetCenter.y,
    z: plane.z - planetCenter.z,
  });

  const distanceAbovePlane = 100;
  topCamera.x = plane.x + radial.x * distanceAbovePlane;
  topCamera.y = plane.y + radial.y * distanceAbovePlane;
  topCamera.z = plane.z + radial.z * distanceAbovePlane;

  const { orientation, state: nextState } = updateTopCameraFrame(
    radial,
    topCameraFrameState
  );
  topCameraFrameState = nextState;

  topCamera.orientation = orientation;
}

function renderFrame(
  ctxPilot: CanvasRenderingContext2D,
  ctxTop: CanvasRenderingContext2D,
  instrument: InstrumentationAdapter,
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

  instrument("GAME", "total", () => {
    updateFPS(nowMs);

    instrument("GAME", "physics", () => {
      updatePhysics(dtSeconds, input, flightState);
    });

    // Update camera based on latest plane position/orientation.
    updateTopCamera(dtSeconds);

    instrument("GAME", "pilot-view", () => {
      renderPilotView(
        ctxPilot,
        {
          plane: flightState.plane,
          pilot: flightState.pilot,
          airplanes,
        },
        instrument
      );
    });

    instrument("GAME", "top-view", () => {
      renderTopView(
        ctxTop,
        {
          plane: flightState.plane,
          topCamera,
          airplanes,
        },
        instrument
      );
    });

    instrument("GAME", "hud", () => {
      renderHUD(ctxTop, flightState.plane, isProfilingEnabled());
    });
  });

  profileFlush();

  requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop, instrument));
}
