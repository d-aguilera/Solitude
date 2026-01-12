import { DEFAULT_DRAW_MODE } from "./config.js";
import {
  applyThrustToPlaneVelocity,
  ControlInput,
  updatePhysics,
  type FlightContext,
  getSignedThrustPercent,
} from "./controls/controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import {
  applyGravity,
  buildInitialGravityState,
} from "../world/physics/gravity.js";
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
  SceneObject,
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
let gravityState: GravityState;

// Pilot camera local offset (right, forward, up) in plane-local units
let pilotCameraLocalOffset: Vec3 = { x: 0, y: 1.7, z: 1.1 };

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

  gravityState = buildInitialGravityState(world, mainPlaneId);

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

  // Compute current signed thrust percent from input for HUD display
  const thrustPercent = getSignedThrustPercent(input);

  profiler.run("GAME", "total", () => {
    updateFPS(nowMs);

    // 1) Advance simulation / physics
    stepSimulation(dtSeconds, input, profiler);

    // 2) Render all visual outputs
    renderAllViews(pilotContext, topContext, profiler, thrustPercent);
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
 * Advance physical simulation only (orientation, forces, gravity).
 */
function stepPhysics(
  dtSeconds: number,
  input: ControlInput,
  profiler: Profiler
): void {
  profiler.run("GAME", "physics", () => {
    // 1) Controls / orientation only (no forward movement here).
    updatePlaneOrientationFromControls(dtSeconds, input);

    // 2) Camera offset adjustments
    updatePilotCameraOffset(dtSeconds, input);

    // 3) Gravity + thrust integration.
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
  const gravityTimeScale = 10;
  const gravityDt = dtSeconds * gravityTimeScale;

  const controlledPlane = getPlaneById(world, mainPlaneId);

  const planeBody = gravityState.bodies[gravityState.mainPlaneBodyIndex];
  applyThrustToPlaneVelocity(
    gravityDt,
    input,
    planeBody.velocity,
    controlledPlane
  );

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
  profiler: Profiler,
  thrustPercent: number
): void {
  const mainPlane = getPlaneById(world, mainPlaneId);

  // For now, we debug all planes in the world in both views.
  const debugPlanes = world.planes;

  profiler.run("GAME", "pilot-view", () => {
    // Pilot view: full scene, including trajectories
    const pilotCamera = getCameraById(world, pilotCameraId);
    const pilotCanvas = pilotContext.canvas;

    const { view: pilotViewConfig, debugOverlay: pilotDebugOverlay } =
      buildPilotViewConfig(
        world,
        pilotCamera,
        mainPilotViewId,
        pilotCanvas.width,
        pilotCanvas.height,
        mainPlane,
        DEFAULT_DRAW_MODE,
        debugPlanes
      );

    renderView(
      pilotContext,
      scene,
      pilotViewConfig,
      profiler,
      pilotDebugOverlay
    );

    renderHUD(
      pilotContext,
      mainPlane,
      isProfilingEnabled(),
      pilotCameraLocalOffset,
      thrustPercent
    );
  });

  profiler.run("GAME", "top-view", () => {
    const topCamera = getCameraById(world, topCameraId);
    const topCanvas = topContext.canvas;

    const { view: topViewConfig, debugOverlay: topDebugOverlay } =
      buildTopViewConfig(
        topCamera,
        topCanvas.width,
        topCanvas.height,
        mainPlane,
        DEFAULT_DRAW_MODE,
        debugPlanes
      );

    // filtered scene without trajectories
    const topScene = makeTopViewScene(scene);

    renderView(topContext, topScene, topViewConfig, profiler, topDebugOverlay);
  });
}

function makeTopViewScene(base: Scene): Scene {
  // Keep everything except trajectory/path polylines
  const filteredObjects: SceneObject[] = base.objects.filter((obj) => {
    // Remove all polyline paths (plane + planets)
    if (obj.kind === "polyline" && obj.id.startsWith("path:")) {
      return false;
    }
    return true;
  });

  return {
    objects: filteredObjects,
    lights: base.lights,
  };
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

function readAndProcessInput(): ControlInput {
  const keys = getKeyState();

  pauseControl(keys.KeyP);
  handleProfilingToggle(keys.KeyO);

  return makeControlInput(keys);
}

function makeControlInput(keys: ReturnType<typeof getKeyState>): ControlInput {
  return {
    burnBackwards: keys.KeyB,
    burnForward: keys.Space,
    camForward: keys.KeyU,
    camBackward: keys.KeyJ,
    camUp: keys.KeyI,
    camDown: keys.KeyK,
    lookDown: keys.ArrowDown,
    lookLeft: keys.ArrowLeft,
    lookRight: keys.ArrowRight,
    lookUp: keys.ArrowUp,
    lookReset: keys.KeyR,
    pitchDown: keys.KeyS,
    pitchUp: keys.KeyW,
    rollLeft: keys.KeyA,
    rollRight: keys.KeyD,
    thrust0: keys.Digit0,
    thrust1: keys.Digit1,
    thrust2: keys.Digit2,
    thrust3: keys.Digit3,
    thrust4: keys.Digit4,
    thrust5: keys.Digit5,
    yawLeft: keys.KeyQ,
    yawRight: keys.KeyE,
  };
}

/**
 * Update all camera positions / orientations.
 */
function updateCameras(): void {
  const mainPlane = getPlaneById(world, mainPlaneId);

  setCameraRelativeToPlane(
    pilotCameraId,
    mainPlane,
    pilotCameraLocalOffset, // dynamic local offset
    frameFromPlaneForPilot
  );

  setCameraRelativeToPlane(
    topCameraId,
    mainPlane,
    { x: 0, y: 0, z: 50 }, // (right, forward, up),
    frameFromPlaneForTop
  );
}

function frameFromPlaneForPilot(plane: Plane): LocalFrame {
  return { ...plane.frame };
}

function frameFromPlaneForTop(plane: Plane): LocalFrame {
  const { right, forward, up } = plane.frame;
  return {
    right: vec.clone(right),
    forward: vec.scale(up, -1), // look down toward the plane
    up: vec.clone(forward), // plane's nose is "up" on screen
  };
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

function updatePilotCameraOffset(dtSeconds: number, input: ControlInput): void {
  if (dtSeconds <= 0) return;

  // Step size in local units per second
  const moveSpeed = 0.5;

  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (input.camForward) dy += moveSpeed;
  if (input.camBackward) dy -= moveSpeed;
  if (input.camUp) dz += moveSpeed;
  if (input.camDown) dz -= moveSpeed;

  if (dx === 0 && dy === 0 && dz === 0) return;

  pilotCameraLocalOffset = {
    x: pilotCameraLocalOffset.x + dx * dtSeconds,
    y: pilotCameraLocalOffset.y + dy * dtSeconds,
    z: pilotCameraLocalOffset.z + dz * dtSeconds,
  };
}
