import { DEFAULT_DRAW_MODE } from "./config.js";
import {
  applyThrustToPlaneVelocity,
  ControlInput,
  updatePhysics,
  type FlightContext,
} from "./controls/controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import { ensureGravityState, applyGravity } from "../world/physics/gravity.js";
import { renderHUD } from "./hud.js";
import { init as initInput, getKeyState } from "./input.js";
import { pauseControl, paused } from "./pause.js";
import { appendPointToPolylineMesh } from "./trajectory.js";
import {
  isProfilingEnabled,
  profileCheck,
  profileFlush,
  setPausedForProfiling,
  setProfilingEnabled,
} from "../profiling/profilingFacade.js";
import type {
  GravityState,
  LocalFrame,
  Plane,
  Profiler,
  Scene,
  Vec3,
  WorldState,
} from "../world/types.js";
import { vec } from "../world/vec3.js";
import { renderView } from "../render/projection/viewRenderer.js";
import {
  buildPilotViewConfig,
  buildTopViewConfig,
} from "../render/projection/viewSetup.js";
import { getCameraById, getPlaneById } from "../world/worldLookup.js";
import {
  createInitialSceneAndWorld,
  PlanetPathMapping,
  syncPlanesToSceneObjects,
  syncPlanetsToSceneObjects,
  syncStarsToSceneObjects,
} from "../world/worldSetup.js";

let lastTimeMs = 0;
let oKeyDown = false;
let accumTime = 0;

let scene: Scene,
  world: WorldState,
  mainPlaneId: string,
  mainPilotViewId: string,
  topCameraId: string,
  pilotCameraId: string,
  planetPathMappings: PlanetPathMapping[];

// Gravity state
let gravityState: GravityState | null = null;

export function startGame(
  pilotContext: CanvasRenderingContext2D,
  topContext: CanvasRenderingContext2D,
  profiler: Profiler
): void {
  const x = createInitialSceneAndWorld();
  scene = x.scene;
  world = x.world;
  mainPlaneId = x.mainPlaneId;
  mainPilotViewId = x.mainPilotViewId;
  topCameraId = x.topCameraId;
  pilotCameraId = x.pilotCameraId;
  planetPathMappings = x.planetPathMappings;

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
  stepPhysics(dtSeconds, input, profiler);
  syncPlanesToSceneObjects(world, scene);
  syncPlanetsToSceneObjects(world, scene);
  syncStarsToSceneObjects(world, scene);
  updateTrajectories(dtSeconds);
  updateCameras();
}

/**
 * Update all camera positions / orientations to follow the simulation state.
 * Kept here so renderAllViews can focus purely on rendering.
 */
function updateCameras(): void {
  const mainPlane = getPlaneById(world, mainPlaneId);
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

  const controlledPlane = getPlaneById(world, mainPlaneId);
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
  const mainPlane = getPlaneById(world, mainPlaneId);

  profiler.run("GAME", "pilot-view", () => {
    // 1) Build view configuration from world & camera
    const pilotCamera = getCameraById(world, pilotCameraId);
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
    const topCamera = getCameraById(world, topCameraId);
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
  const plane = getPlaneById(world, mainPlaneId);
  const camera = getCameraById(world, topCameraId);

  const { right, forward, up } = plane.frame;

  const distanceAbovePlane = 50;

  // Position: directly above plane center along its local up axis
  const offset = vec.scale(up, distanceAbovePlane);
  camera.position = vec.add(plane.position, offset);

  // Orientation: top-down, bolted to plane
  camera.frame = {
    right: vec.clone(right),
    forward: vec.scale(up, -1), // look down toward the plane
    up: vec.clone(forward), // plane's nose is "up" on screen
  };
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
    fastThrust: keys.AltLeft || keys.AltRight, // Alt = 1e4
    ultraThrust: keys.ShiftLeft || keys.ShiftRight, // Shift = 1e2
  };
}

// Follow-plane logic for pilot camera, using an offset
function updatePilotCamera(plane: Plane): void {
  const localOffset = { x: 0, y: -20, z: 5 }; // (right, forward, up)
  setCameraRelativeToPlane(pilotCameraId, plane, localOffset, (p) => ({
    ...p.frame,
  }));
}

function appendPlaneTrajectoryPoint(): void {
  const mainPlane = getPlaneById(world, mainPlaneId);
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

function setCameraRelativeToPlane(
  cameraId: string,
  plane: Plane,
  localOffset: Vec3,
  frameFromPlane: (plane: Plane) => LocalFrame
): void {
  const camera = getCameraById(world, cameraId);
  const { right, forward, up } = plane.frame;

  const worldOffset = vec.add3(
    vec.scale(right, localOffset.x),
    vec.scale(forward, localOffset.y),
    vec.scale(up, localOffset.z)
  );

  camera.position = vec.add(plane.position, worldOffset);
  camera.frame = frameFromPlane(plane);
}
