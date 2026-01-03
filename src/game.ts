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
import { scene, pilot, plane } from "./setup.js";
import type { Camera, Profiler, SceneObject } from "./types.js";

let lastTimeMs = 0;
let pKeyDown = false;

const flightState: FlightState = {
  plane,
  pilot,
};

let topCameraFrameState: TopCameraFrameState | null = null;

const mainAirplane: SceneObject = scene.airplanes[0];

const topCamera: Camera = {
  x: plane.x,
  y: plane.y,
  z: plane.z + 50,
  orientation: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
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
  pilotContext: CanvasRenderingContext2D,
  topContext: CanvasRenderingContext2D,
  profiler: Profiler
): void {
  initInput();
  updatePlaneAxesSpherical(flightState);
  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(
      renderFrame.bind(null, pilotContext, topContext, profiler)
    );
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

function updateTopCamera(): void {
  const plane = flightState.plane;

  const radial = vec.normalize({
    x: plane.x - planetCenter.x,
    y: plane.y - planetCenter.y,
    z: plane.z - planetCenter.z,
  });

  const distanceAbovePlane = 50;
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

// Keep visual representation in sync with simulated plane state.
function syncMainAirplaneToPlane(): void {
  const plane = flightState.plane;
  mainAirplane.x = plane.x;
  mainAirplane.y = plane.y;
  mainAirplane.z = plane.z;
  mainAirplane.orientation = plane.orientation;
  mainAirplane.scale = plane.scale;
}

function renderFrame(
  pilotContext: CanvasRenderingContext2D,
  topContext: CanvasRenderingContext2D,
  profiler: Profiler,
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

  profiler.run("GAME", "total", () => {
    updateFPS(nowMs);

    profiler.run("GAME", "physics", () => {
      updatePhysics(dtSeconds, input, flightState);
    });

    // Keep scene airplane in sync with physics plane.
    syncMainAirplaneToPlane();

    // Update camera based on latest plane position/orientation.
    updateTopCamera();

    profiler.run("GAME", "pilot-view", () => {
      renderPilotView(
        pilotContext,
        {
          plane: flightState.plane,
          pilot: flightState.pilot,
          airplanes: scene.airplanes,
        },
        scene,
        profiler
      );
    });

    profiler.run("GAME", "top-view", () => {
      renderTopView(
        topContext,
        {
          plane: flightState.plane,
          topCamera,
          airplanes: scene.airplanes,
        },
        scene,
        profiler
      );
    });

    profiler.run("GAME", "hud", () => {
      renderHUD(topContext, flightState.plane, isProfilingEnabled());
    });
  });

  profileFlush();

  requestAnimationFrame(
    renderFrame.bind(null, pilotContext, topContext, profiler)
  );
}
