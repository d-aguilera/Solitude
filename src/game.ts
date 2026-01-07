import { DEFAULT_DRAW_MODE } from "./config.js";
import {
  applyThrustToPlaneVelocity,
  ControlInput,
  updatePhysics,
  type FlightContext,
} from "./controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import { ensureGravityState, applyGravity } from "./gravity.js";
import { renderHUD } from "./hud.js";
import { init as initInput, getKeyState } from "./input.js";
import { mat3FromLocalFrame } from "./localFrame.js";
import { pauseControl, paused } from "./pause.js";
import { appendPointToPolylineMesh } from "./planet.js";
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
import type {
  Camera,
  GravityState,
  Plane,
  Profiler,
  WorldState,
} from "./types.js";
import { vec } from "./vec3.js";
import { renderView } from "./viewRenderer.js";
import { buildPilotViewConfig, buildTopViewConfig } from "./viewSetup.js";
import {
  createInitialSceneAndWorld,
  syncPlanetsToSceneObjects,
} from "./worldSetup.js";

let lastTimeMs = 0;
let oKeyDown = false;
let accumTime = 0;

let topCameraFrameState: TopCameraFrameState | null = null;

const {
  scene: scene,
  world: world,
  mainPlaneId: mainPlaneId,
  mainPilotViewId: mainPilotViewId,
  topCameraId: topCameraId,
  pilotCameraId,
  planetPathMappings,
} = createInitialSceneAndWorld();

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

  const input = readAndProcessInput();
  const dtSeconds = paused ? 0 : dtMs / 1000;

  setPausedForProfiling(paused);
  profileCheck();

  profiler.run("GAME", "total", () => {
    updateFPS(nowMs);

    // 1) Advance simulation / physics
    stepSimulation(dtSeconds, input, profiler);

    // 2) Render all visual outputs
    renderAllViews(pilotContext, topContext, profiler);
  });

  profileFlush();

  requestAnimationFrame(
    renderFrame.bind(null, pilotContext, topContext, profiler)
  );
}

/**
 * Advance world/scene state (physics, gravity, trajectories, cameras).
 *
 * Responsibilities kept here:
 *  - Orchestrate per-frame simulation steps in the correct order
 *  - Keep scene objects in sync with simulated world entities
 */
function stepSimulation(
  dtSeconds: number,
  input: ControlInput,
  profiler: Profiler
): void {
  // 1) Physics integration (orientation, gravity, thrust)
  stepPhysics(dtSeconds, input, profiler);

  // 2) Keep visual representation in sync with simulated plane state.
  //    This is done once per frame after physics, so renderers see a
  //    consistent world/scene snapshot.
  syncPlanesToSceneObjects();
  syncPlanetsToSceneObjects(world, scene);

  // 3) Sample trajectories (derived from updated positions)
  updateTrajectories(dtSeconds);

  // 4) Update cameras to follow the new simulation state
  updateCameras();
}

/**
 * Update all camera positions / orientations to follow the simulation state.
 * Kept here so renderAllViews can focus purely on rendering.
 */
function updateCameras(): void {
  const mainPlane = getPlane(world, mainPlaneId);
  updatePilotCamera(mainPlane);
  updateTopCamera();
}

/**
 * Advance physical simulation only (orientation, forces, gravity).
 *
 * Cohesive responsibilities:
 *  - Update plane orientation from controls (no position movement here).
 *  - Integrate gravity + thrust and update body positions/velocities.
 */
function stepPhysics(
  dtSeconds: number,
  input: ControlInput,
  profiler: Profiler
): void {
  profiler.run("GAME", "physics", () => {
    // 1) Controls / orientation only (no forward movement here).
    updatePlaneOrientationFromControls(dtSeconds, input);

    // 2) Gravity + thrust integration.
    integrateForcesAndGravity(dtSeconds, input);
  });
}

/**
 * Handles control-input-based orientation updates for the controlled plane.
 */
function updatePlaneOrientationFromControls(
  dtSeconds: number,
  input: ControlInput
): void {
  const flightCtx: FlightContext = {
    world,
    controlledPlaneId: mainPlaneId,
    pilotViewId: mainPilotViewId,
  };
  updatePhysics(dtSeconds, input, flightCtx);
}

/**
 * Handles forces and orbital physics:
 *  - Maintaining GravityState
 *  - Applying thrust into the plane's body velocity
 *  - Applying gravity and integrating positions
 */
function integrateForcesAndGravity(
  dtSeconds: number,
  input: ControlInput
): void {
  gravityState = ensureGravityState(world, gravityState);

  // Simulate gravity at an accelerated timescale so orbits evolve faster.
  const gravityTimeScale = 10; // e.g. 10x real time
  const gravityDt = dtSeconds * gravityTimeScale;

  const controlledPlane = getPlane(world, mainPlaneId);
  const planeBody = gravityState.bodies.find((b) => b.id === mainPlaneId);
  if (planeBody) {
    applyThrustToPlaneVelocity(
      gravityDt,
      input,
      planeBody.velocity,
      controlledPlane
    );
  }

  applyGravity(gravityDt, world, gravityState);
}

/**
 * Sample and update trajectory polylines for the plane and planets.
 * Separated from core physics integration for better cohesion and testability.
 */
function updateTrajectories(dtSeconds: number): void {
  const sampleInterval = 1.0; // seconds

  if (paused) {
    return;
  }

  accumTime += dtSeconds;

  if (accumTime >= sampleInterval) {
    appendPlaneTrajectoryPoint();
    appendPlanetTrajectories();
    accumTime = 0;
  }
}

/**
 * Update cameras and render pilot / top views and HUD.
 * No simulation or game-state mutation beyond cameras/HUD.
 */
function renderAllViews(
  pilotContext: CanvasRenderingContext2D,
  topContext: CanvasRenderingContext2D,
  profiler: Profiler
): void {
  const mainPlane = getPlane(world, mainPlaneId);

  profiler.run("GAME", "pilot-view", () => {
    // 1) Build view configuration from world & camera
    const pilotCamera = getPilotCamera(world);
    const pilotCanvas = pilotContext.canvas;

    const pilotViewConfig = buildPilotViewConfig(
      world,
      pilotCamera,
      mainPilotViewId,
      pilotCanvas.width,
      pilotCanvas.height,
      DEFAULT_DRAW_MODE
    );

    // 2) Render pilot view
    renderView(pilotContext, scene, pilotViewConfig, profiler);
  });

  profiler.run("GAME", "top-view", () => {
    // 1) Build view configuration from world & camera
    const topCamera = getTopCamera(world);
    const topCanvas = topContext.canvas;

    const topViewConfig = buildTopViewConfig(
      world,
      topCamera,
      topCanvas.width,
      topCanvas.height,
      DEFAULT_DRAW_MODE
    );

    // 2) Render top view
    renderView(topContext, scene, topViewConfig, profiler);
  });

  profiler.run("GAME", "hud", () => {
    renderHUD(topContext, mainPlane, isProfilingEnabled());
  });
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

  // Plane's local "up" in world space
  const radial = vec.normalize(plane.frame.up);

  const distanceAbovePlane = 50;
  const camPos = camera.position;
  const planePos = plane.position;
  camPos.x = planePos.x + radial.x * distanceAbovePlane;
  camPos.y = planePos.y + radial.y * distanceAbovePlane;
  camPos.z = planePos.z + radial.z * distanceAbovePlane;

  const { frame, state: nextState } = updateTopCameraFrame(
    radial,
    topCameraFrameState
  );
  topCameraFrameState = nextState;
  camera.frame = frame;
}

// Keep visual representation in sync with simulated plane state.
function syncPlanesToSceneObjects(): void {
  for (const plane of world.planes) {
    const sceneObjId = `sceneobj:${plane.id}`;
    const obj = scene.objects.find((o) => o.id === sceneObjId);
    if (!obj) {
      throw new Error(`Scene object not found for plane id: ${plane.id}`);
    }

    obj.position = { ...plane.position };
    obj.orientation = mat3FromLocalFrame(plane.frame);
    obj.scale = plane.scale;
  }
}

function readAndProcessInput(): ControlInput {
  const keys = getKeyState();

  pauseControl(keys.KeyP);
  handleProfilingToggle(keys.KeyO);

  return makeControlInput(keys);
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
    brake: keys.KeyB,
    hyper: keys.KeyH,
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

function getPilotCamera(world: WorldState): Camera {
  const camera = world.cameras.find((c) => c.id === pilotCameraId);
  if (!camera) {
    throw new Error(`Pilot camera not found: ${pilotCameraId}`);
  }
  return camera;
}

// Follow-plane logic for pilot camera, using an offset
function updatePilotCamera(plane: Plane): void {
  const camera = getPilotCamera(world);

  // Offsets in plane-local space:
  const backwardOffset = -20.0; // behind
  const upwardOffset = 5.0; // above

  const forward = plane.frame.forward;
  const up = plane.frame.up;
  const position = plane.position;

  // Position camera relative to plane
  camera.position.x =
    position.x + forward.x * backwardOffset + up.x * upwardOffset;
  camera.position.y =
    position.y + forward.y * backwardOffset + up.y * upwardOffset;
  camera.position.z =
    position.z + forward.z * backwardOffset + up.z * upwardOffset;

  // Align camera orientation to the plane's LocalFrame
  camera.frame = { ...plane.frame };
}

function appendPlaneTrajectoryPoint(): void {
  const mainPlane = getPlane(world, mainPlaneId);
  const pathObj = scene.objects.find((o) => o.id === "path:plane:main");
  if (pathObj) {
    appendPointToPolylineMesh(pathObj.mesh, mainPlane.position);
  }
}

function appendPlanetTrajectories(): void {
  for (const mapping of planetPathMappings) {
    const bodyObj = scene.objects.find((o) => o.id === mapping.planetId);
    const pathObj = scene.objects.find((o) => o.id === mapping.pathId);
    if (bodyObj && pathObj) {
      appendPointToPolylineMesh(pathObj.mesh, bodyObj.position);
    }
  }
}
