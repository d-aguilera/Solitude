import type {
  AppWorld,
  ControlInput,
  ControlledBodyState,
  ControlState,
  EnvInput,
  Plane,
} from "./appInternals.js";
import { ProfilerController } from "./appPorts.js";
import {
  applyThrustToVelocity,
  updateBodyOrientationFromInput,
  getSignedThrustPercent,
  createInitialControlState,
} from "./controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import { init as initInput, readControlInput, readEnvInput } from "./input.js";
import { pauseControl, paused } from "./pause.js";
import { appendPointToPolylineMesh } from "./trajectory.js";
import { buildPilotView, buildTopView } from "./viewComposition.js";
import { getPlaneById } from "./worldLookup.js";
import {
  createInitialSceneAndWorld,
  syncPlanesToSceneObjects,
  syncPlanetsToSceneObjects,
  syncStarsToSceneObjects,
  syncLightsToStars,
} from "./worldSetupApp.js";
import type {
  DomainWorld,
  GravityEngine,
  GravityState,
  LocalFrame,
  PlanetPathMapping,
  Profiler,
  Vec3,
} from "../domain/domainPorts.js";
import { rotateFrameAroundAxis } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import { getDomainCameraById } from "../domain/worldLookup.js";
import { fps } from "./fps.js";
import type {
  HudRenderData,
  Renderer,
  RenderPlane,
} from "../render/renderPorts.js";
import type { Scene } from "../render/scenePorts.js";

let lastTimeMs = 0;
let oKeyDown = false;
let accumTime = 0;

let scene: Scene;
let world: AppWorld;
let mainPlaneId: string;
let topCameraId: string;
let pilotCameraId: string;
let planetPathMappings: PlanetPathMapping[];

let gravityState: GravityState;
let gravityEngine: GravityEngine;

let mainPlaneBodyIndex: number = -1;

let pilotCameraLocalOffset: Vec3 = { x: 0, y: 1.7, z: 1.1 };

let controlState: ControlState = createInitialControlState();

let pilotContext: CanvasRenderingContext2D;
let topContext: CanvasRenderingContext2D;

let profilerController: ProfilerController;

export function startGame(
  renderer: Renderer,
  engine: GravityEngine,
  profiler: Profiler & ProfilerController,
  contexts: {
    pilotContext: CanvasRenderingContext2D;
    topContext: CanvasRenderingContext2D;
  },
): void {
  pilotContext = contexts.pilotContext;
  topContext = contexts.topContext;

  profilerController = profiler;

  const x = createInitialSceneAndWorld();
  scene = x.scene;
  world = x.world;
  mainPlaneId = x.mainPlaneId;
  topCameraId = x.topCameraId;
  pilotCameraId = x.pilotCameraId;
  planetPathMappings = x.planetPathMappings;

  gravityEngine = engine;

  const domainWorld = toDomainWorld(world);
  gravityState = gravityEngine.buildInitialState(domainWorld);

  // Determine which gravity body corresponds to the main plane.
  mainPlaneBodyIndex = gravityState.bindings.findIndex(
    (b) => b.kind === "plane" && b.id === mainPlaneId,
  );

  if (mainPlaneBodyIndex === -1) {
    throw new Error(
      `startGame: main plane body not found in gravity bindings for id=${mainPlaneId}`,
    );
  }

  controlState = createInitialControlState();

  initInput();
  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(renderFrame.bind(null, renderer, profiler));
  });
}

function renderFrame(
  renderer: Renderer,
  profiler: Profiler,
  nowMs: number,
): void {
  const dtMs = nowMs - lastTimeMs;
  const dtSeconds = paused ? 0 : dtMs / 1000;
  lastTimeMs = nowMs;

  profiler.run("GAME", "total", () => {
    const envInput: EnvInput = readEnvInput();
    pauseControl(envInput.pauseToggle);
    handleProfilingToggle(envInput.profilingToggle);

    profilerController.setPaused(paused);
    profilerController.check();

    updateFPS(nowMs);

    const controlInput: ControlInput = readControlInput();
    stepSimulation(dtSeconds, controlInput, profiler);
    renderCurrentFrame(renderer, profiler, controlInput);
  });

  profilerController.flush();

  requestAnimationFrame(renderFrame.bind(null, renderer, profiler));
}

/**
 * Render the current world/scene state using the configured renderer.
 */
function renderCurrentFrame(
  renderer: Renderer,
  profiler: Profiler,
  input: ControlInput,
): void {
  const mainPlane = getPlaneById(world, mainPlaneId);
  const profilingEnabled = profilerController.isEnabled();
  const thrustPercent = getSignedThrustPercent(input, controlState);

  const pilotViewConfig = buildPilotView(
    world,
    pilotCameraId,
    mainPlane,
    "faces",
    pilotContext.canvas.width,
    pilotContext.canvas.height,
  );

  // Pilot scene: full scene, unfiltered
  const pilotScene: Scene = scene;

  const topViewConfig = buildTopView(
    world,
    topCameraId,
    mainPlane,
    "faces",
    topContext.canvas.width,
    topContext.canvas.height,
  );

  // Top scene: no trajectory polylines
  const topScene: Scene = {
    objects: scene.objects.filter((obj) => {
      if (obj.kind === "polyline" && obj.id.startsWith("path:")) {
        return false;
      }
      return true;
    }),
    lights: scene.lights,
  };

  const hud: HudRenderData = {
    speedMps: vec3.length(mainPlane.velocity),
    fps,
    profilingEnabled,
    pilotCameraLocalOffset,
    thrustPercent,
  };

  renderer.renderFrame({
    pilotScene,
    topScene,
    mainPlane: toRenderPlane(mainPlane),
    pilotContext,
    topContext,
    profiler,
    pilotView: pilotViewConfig,
    topView: topViewConfig,
    hud,
  });
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
  profiler: Profiler,
): void {
  stepPhysics(dtSeconds, input, profiler);

  syncPlanesToSceneObjects(world, scene);
  syncPlanetsToSceneObjects(world, scene);
  syncStarsToSceneObjects(world, scene);
  syncLightsToStars(world, scene);

  updateTrajectories(dtSeconds);
  updateCameras();
}

/**
 * Adapt the main plane and its pilot view into the data structures
 * used by the controls module.
 */
function makeControlledBodyState(plane: Plane): ControlledBodyState {
  return {
    frame: plane.frame,
    velocity: plane.velocity,
  };
}

function writeBackControlledBodyState(
  plane: Plane,
  body: ControlledBodyState,
): void {
  plane.frame = body.frame;
  plane.velocity = body.velocity;
}

/**
 * Advance physical simulation only (orientation, forces, gravity).
 */
function stepPhysics(
  dtSeconds: number,
  input: ControlInput,
  profiler: Profiler,
): void {
  profiler.run("GAME", "physics", () => {
    updatePlaneOrientationFromControls(dtSeconds, input);
    updatePilotCameraOffset(dtSeconds, input);
    integrateForcesAndGravity(dtSeconds, input);
  });
}

/**
 * Handles control-input-based orientation updates for the controlled plane.
 * Also updates the persistent control state and pilot view look state.
 */
function updatePlaneOrientationFromControls(
  dtSeconds: number,
  input: ControlInput,
): void {
  const plane = getPlaneById(world, mainPlaneId);
  const bodyState = makeControlledBodyState(plane);

  updateBodyOrientationFromInput(dtSeconds, input, controlState, bodyState);

  writeBackControlledBodyState(plane, bodyState);
}

/**
 * Handles forces and orbital physics:
 *  - Maintaining GravityState
 *  - Applying thrust into the plane's body velocity
 *  - Applying gravity and integrating positions
 */
function integrateForcesAndGravity(
  dtSeconds: number,
  input: ControlInput,
): void {
  const gravityTimeScale = 10;
  const gravityDt = dtSeconds * gravityTimeScale;

  if (gravityDt <= 0) {
    return;
  }

  // 1) Apply thrust to the main plane's body velocity in gravityState.
  const controlledPlane = getPlaneById(world, mainPlaneId);

  const planeBody = gravityState.bodies[mainPlaneBodyIndex];

  const bodyState: ControlledBodyState = {
    frame: controlledPlane.frame,
    velocity: planeBody.velocity,
  };

  applyThrustToVelocity(gravityDt, input, controlState, bodyState);

  planeBody.velocity = bodyState.velocity;

  // 2) Step gravity (updates positions in world via bindings, returns new velocities in gravityState).
  const domainWorld: DomainWorld = world;
  gravityState = gravityEngine.step(gravityDt, domainWorld, gravityState);

  // 3) Sync plane velocities in WorldState from gravityState so debug & HUD see them.
  syncPlaneVelocitiesFromGravity();
}

function syncPlaneVelocitiesFromGravity(): void {
  for (const binding of gravityState.bindings) {
    if (binding.kind !== "plane") continue;

    const body = gravityState.bodies[binding.planeIndex];
    if (!body) continue;

    const plane = world.planeBodies[binding.planeIndex];
    plane.velocity = { ...body.velocity };
    plane.speed = vec3.length(plane.velocity);
  }
}

/**
 * Sample and update trajectory polylines for the plane and planets.
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

function handleProfilingToggle(profilingTogglePressed: boolean): void {
  if (profilingTogglePressed) {
    if (!oKeyDown) {
      const current = getProfilingEnabledFromEnv();
      const next = !current;
      profilerController.setEnabled(next);
      setProfilingEnabledInEnv(next);
      oKeyDown = true;
    }
  } else if (oKeyDown) {
    oKeyDown = false;
  }
}

/**
 * Update all camera positions / orientations.
 */
function updateCameras(): void {
  const mainPlane = getPlaneById(world, mainPlaneId);

  setCameraRelativeToPlane(
    pilotCameraId,
    mainPlane,
    pilotCameraLocalOffset,
    frameFromPlaneForPilot,
  );

  setCameraRelativeToPlane(
    topCameraId,
    mainPlane,
    { x: 0, y: 0, z: 50 },
    frameFromPlaneForTop,
  );
}

function frameFromPlaneForPilot(plane: Plane): LocalFrame {
  const base = plane.frame;
  const { azimuth, elevation } = controlState.look;

  let frame: LocalFrame = {
    right: vec3.clone(base.right),
    forward: vec3.clone(base.forward),
    up: vec3.clone(base.up),
  };

  if (azimuth !== 0) {
    frame = rotateFrameAroundAxis(frame, frame.up, azimuth);
  }
  if (elevation !== 0) {
    frame = rotateFrameAroundAxis(frame, frame.right, elevation);
  }

  return frame;
}

function frameFromPlaneForTop(plane: Plane): LocalFrame {
  const { right, forward, up } = plane.frame;
  return {
    right: vec3.clone(right),
    forward: vec3.scale(up, -1),
    up: vec3.clone(forward),
  };
}

function setCameraRelativeToPlane(
  cameraId: string,
  plane: Plane,
  localOffset: Vec3,
  frameFromPlane: (plane: Plane) => LocalFrame,
): void {
  const camera = getDomainCameraById(world, cameraId);
  const { right, forward, up } = plane.frame;

  const worldOffset = vec3.add3(
    vec3.scale(right, localOffset.x),
    vec3.scale(forward, localOffset.y),
    vec3.scale(up, localOffset.z),
  );

  camera.position = vec3.add(plane.position, worldOffset);
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

function toDomainWorld(world: AppWorld): DomainWorld {
  return {
    planeBodies: world.planeBodies,
    cameras: world.cameras,
    planets: world.planets,
    planetPhysics: world.planetPhysics,
    stars: world.stars,
    starPhysics: world.starPhysics,
  };
}

function toRenderPlane(plane: Plane): RenderPlane {
  return {
    id: plane.id,
    position: plane.position,
    velocity: plane.velocity,
  };
}
