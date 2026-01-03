import { ControlInput, updatePhysics, type FlightContext } from "./controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import { renderHUD } from "./hud.js";
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
import { createInitialSceneAndWorld } from "./setup.js";
import type {
  Camera,
  Plane,
  Profiler,
  Scene,
  View,
  WorldState,
  GravityState,
} from "./types.js";
import { renderView } from "./viewRenderer.js";
import { ensureGravityState, applyGravityAndThrust } from "./gravity.js";

let lastTimeMs = 0;
let oKeyDown = false;

let topCameraFrameState: TopCameraFrameState | null = null;

const {
  scene: initialScene,
  world: initialWorld,
  mainPlaneId: planeId,
  mainPilotViewId: pilotId,
  topCameraId: camId,
} = createInitialSceneAndWorld();

let scene: Scene = initialScene;
let world: WorldState = initialWorld;
let mainPlaneId: string = planeId;
let mainPilotViewId: string = pilotId;
let topCameraId: string = camId;

// Gravity state
let gravityState: GravityState | null = null;

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

function renderFrame(
  pilotContext: CanvasRenderingContext2D,
  topContext: CanvasRenderingContext2D,
  profiler: Profiler,
  nowMs: number
): void {
  const dtMs = nowMs - lastTimeMs;
  lastTimeMs = nowMs;

  const dtSeconds = paused ? 0 : dtMs / 1000;

  const keys = getKeyState();

  pauseControl(keys.KeyP);
  handleProfilingToggle(keys.KeyO);

  const input = makeControlInput(keys);

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

      gravityState = ensureGravityState(world, scene, gravityState);

      applyGravityAndThrust(
        dtSeconds,
        world,
        scene,
        gravityState,
        mainPlaneId,
        input.burn
      );
    });

    syncPlanesToSceneObjects();
    updateTopCamera();

    const mainPlane = getPlane(world, mainPlaneId);

    profiler.run("GAME", "pilot-view", () => {
      renderPilotView(pilotContext, mainPlane, profiler);
    });

    profiler.run("GAME", "top-view", () => {
      renderTopView(topContext, profiler);
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

function handleProfilingToggle(oKeyPressed: boolean): void {
  if (oKeyPressed) {
    if (!oKeyDown) {
      const current = getProfilingEnabledFromEnv();
      const next = !current;
      setProfilingEnabled(next);
      setProfilingEnabledInEnv(next);
      oKeyDown = true;
    }
  } else if (oKeyDown) {
    oKeyDown = false;
  }
}

function updateTopCamera(): void {
  const plane = getPlane(world, mainPlaneId);
  const camera = getTopCamera(world);

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

function renderPilotView(
  pilotContext: CanvasRenderingContext2D,
  mainPlane: Plane,
  profiler: Profiler
) {
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
}

function renderTopView(
  topContext: CanvasRenderingContext2D,
  profiler: Profiler
) {
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
}

function makeControlInput(keys: ReturnType<typeof getKeyState>): ControlInput {
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
    burn: keys.Space,
  };
}

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
