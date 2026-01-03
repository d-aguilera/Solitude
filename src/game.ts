import { ControlInput, updatePhysics, type FlightContext } from "./controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import { init as initInput, getKeyState } from "./input.js";
import { vec } from "./math.js";
import { pauseControl, paused } from "./pause.js";
import {
  isProfilingEnabled,
  profileCheck,
  profileFlush,
  setPausedForProfiling,
  setProfilingEnabled,
} from "./profilingFacade.js";
import {
  makePilotView,
  makeTopView,
  updateTopCameraFrame,
  type TopCameraFrameState,
} from "./projection.js";
import { renderHUD, renderView } from "./renderer.js";
import { createInitialSceneAndWorld } from "./setup.js";
import type {
  Camera,
  Plane,
  Profiler,
  Scene,
  View,
  WorldState,
} from "./types.js";

let lastTimeMs = 0;
let pKeyDown = false;

let scene: Scene;
let world: WorldState;
let mainPlaneId: string;
let mainPilotViewId: string;
let topCameraId: string;

let topCameraFrameState: TopCameraFrameState | null = null;

const {
  scene: initialScene,
  world: initialWorld,
  mainPlaneId: planeId,
  mainPilotViewId: pilotId,
  topCameraId: camId,
} = createInitialSceneAndWorld();

scene = initialScene;
world = initialWorld;
mainPlaneId = planeId;
mainPilotViewId = pilotId;
topCameraId = camId;

function getTopCamera(world: WorldState): Camera {
  const camera = world.cameras.find((c) => c.id === topCameraId);
  if (!camera) {
    throw new Error(`Top camera not found: ${topCameraId}`);
  }
  return camera;
}

function getPlane(world: WorldState, id: string): Plane {
  const plane = world.planes.find((p) => p.id === id);
  if (!plane) {
    throw new Error(`Plane not found: ${id}`);
  }
  return plane;
}

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
  const plane = getPlane(world, mainPlaneId);
  const camera = getTopCamera(world);

  // Use the plane's local up direction as the "radial" direction for the top-down camera.
  const radial = vec.normalize(plane.up);

  const distanceAbovePlane = 50;
  const camPos = camera.position;
  const planePos = plane.position;
  camPos.x = planePos.x + radial.x * distanceAbovePlane;
  camPos.y = planePos.y + radial.y * distanceAbovePlane;
  camPos.z = planePos.z + radial.z * distanceAbovePlane;

  const { orientation, state: nextState } = updateTopCameraFrame(
    radial,
    topCameraFrameState
  );
  topCameraFrameState = nextState;

  camera.orientation = orientation;
}

// Keep visual representation in sync with simulated plane state.
function syncPlanesToSceneObjects(): void {
  world.planes.forEach((p) => {
    const obj = scene.objects.find(
      (o) => o.mesh.objectType === "plane" && o.scale === p.scale
    );
    if (!obj) return;

    obj.position = { ...p.position };
    obj.orientation = p.orientation;
    obj.scale = p.scale;
  });
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
      const flightCtx: FlightContext = {
        world,
        controlledPlaneId: mainPlaneId,
        pilotViewId: mainPilotViewId,
      };
      updatePhysics(dtSeconds, input, flightCtx);
    });

    // Keep scene airplane(s) in sync with simulation.
    syncPlanesToSceneObjects();

    // Update camera based on latest plane position/orientation.
    updateTopCamera();

    const mainPlane = getPlane(world, mainPlaneId);

    profiler.run("GAME", "pilot-view", () => {
      const pilotView = world.pilotViews.find((p) => p.id === mainPilotViewId);
      if (!pilotView) return;

      const projection = makePilotView({
        planePosition: mainPlane.position,
        planeOrientation: mainPlane.orientation,
        pilotAzimuth: pilotView.azimuth,
        pilotElevation: pilotView.elevation,
      });

      const pilotViewConfig: View = {
        projection,
        cameraPos: mainPlane.position,
      };

      renderView(pilotContext, scene, pilotViewConfig, profiler);
    });

    profiler.run("GAME", "top-view", () => {
      const camera = getTopCamera(world);

      const projection = makeTopView({
        cameraPosition: camera.position,
        cameraOrientation: camera.orientation,
      });

      const topViewConfig: View = {
        projection,
        cameraPos: camera.position,
      };

      renderView(topContext, scene, topViewConfig, profiler);
    });

    profiler.run("GAME", "hud", () => {
      renderHUD(topContext, mainPlane, isProfilingEnabled());
    });
  });

  profileFlush();

  requestAnimationFrame(
    renderFrame.bind(null, pilotContext, topContext, profiler)
  );
}
