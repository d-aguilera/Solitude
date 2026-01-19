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
import type { Renderer, RenderSurface2D } from "../render/renderPorts.js";
import type {
  AppWorld,
  ControlInput,
  ControlledBodyState,
  ControlState,
  Ship,
} from "./appInternals.js";
import type { GameDependencies } from "./appPorts.js";
import type {
  HudRenderData,
  ProfilerController,
  TickCallback,
} from "./appPorts.js";
import type { Scene } from "../appScene/appScenePorts.js";
import {
  applyThrustToVelocity,
  updateBodyOrientationFromInput,
  getSignedThrustPercent,
  createInitialControlState,
} from "./controls.js";
import { updateFPS, fps } from "./fps.js";
import { pauseControl, paused } from "./pause.js";
import { appendPointToPolylineMesh } from "./trajectory.js";
import { ViewComposer } from "./ViewComposer.js";
import { getShipById } from "./worldLookup.js";
import {
  createInitialSceneAndWorld,
  syncShipsToSceneObjects,
  syncPlanetsToSceneObjects,
  syncStarsToSceneObjects,
  syncLightsToStars,
} from "./worldSetupApp.js";

let accumTime = 0;

let scene: Scene;
let world: AppWorld;
let mainShipId: string;
let topCameraId: string;
let pilotCameraId: string;
let planetPathMappings: PlanetPathMapping[];

let gravityState: GravityState;
let gravityEngine: GravityEngine;

let mainShipBodyIndex: number = -1;

let pilotCameraLocalOffset: Vec3 = { x: 0, y: 1.7, z: 1.1 };

let controlState: ControlState;

let profilerInstance: Profiler;
let profilerController: ProfilerController;
let rendererInstance: Renderer;

let pilotSurface: RenderSurface2D;
let topSurface: RenderSurface2D;

// Single shared view composer instance for all views.
const viewComposer = new ViewComposer();

/**
 * App‑core game entry.
 */
export function startGame(deps: GameDependencies): TickCallback {
  rendererInstance = deps.renderer;
  gravityEngine = deps.gravityEngine;
  profilerInstance = deps.profiler;
  profilerController = deps.profilerController;
  pilotSurface = deps.pilotSurface;
  topSurface = deps.topSurface;

  const x = createInitialSceneAndWorld();
  scene = x.scene;
  world = x.world;
  mainShipId = x.mainShipId;
  topCameraId = x.topCameraId;
  pilotCameraId = x.pilotCameraId;
  planetPathMappings = x.planetPathMappings;

  const domainWorld = toDomainWorld(world);
  gravityState = gravityEngine.buildInitialState(domainWorld);

  // Determine which gravity body corresponds to the main ship.
  mainShipBodyIndex = gravityState.bindings.findIndex(
    (b) => b.kind === "ship" && b.id === mainShipId,
  );

  if (mainShipBodyIndex === -1) {
    throw new Error(
      `startGame: main ship body not found in gravity bindings for id=${mainShipId}`,
    );
  }

  controlState = createInitialControlState();

  let lastTimeMs = 0;
  let initialized = false;

  /**
   * Per‑frame update/render entry called by the outer loop.
   */
  return ({ nowMs, controlInput, envInput, profilingEnabled }) => {
    if (!initialized) {
      lastTimeMs = nowMs;
      initialized = true;
      return;
    }

    const dtMs = nowMs - lastTimeMs;
    const dtSeconds = paused ? 0 : dtMs / 1000;
    lastTimeMs = nowMs;

    profilerInstance.run("GAME", "total", () => {
      pauseControl(envInput.pauseToggle);

      profilerController.setEnabled(profilingEnabled);
      profilerController.setPaused(paused);
      profilerController.check();

      updateFPS(nowMs);

      stepSimulation(dtSeconds, controlInput);
      renderCurrentFrame(controlInput);
    });

    profilerController.flush();
  };
}

/**
 * Render the current world/scene state using the configured renderer.
 */
function renderCurrentFrame(input: ControlInput): void {
  const mainShip = getShipById(world, mainShipId);
  const profilingEnabled = profilerController.isEnabled();
  const thrustPercent = getSignedThrustPercent(input, controlState);

  const pilotViewConfig = viewComposer.buildPilotView(
    world,
    pilotCameraId,
    mainShip,
    "faces",
    pilotSurface.width,
    pilotSurface.height,
  );

  // Pilot scene: full scene, unfiltered
  const pilotScene: Scene = scene;

  const topViewConfig = viewComposer.buildTopView(
    world,
    topCameraId,
    mainShip,
    "faces",
    topSurface.width,
    topSurface.height,
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
    speedMps: vec3.length(mainShip.velocity),
    fps,
    profilingEnabled,
    pilotCameraLocalOffset,
    thrustPercent,
  };

  rendererInstance.renderFrame(
    pilotScene,
    topScene,
    pilotSurface,
    topSurface,
    pilotViewConfig,
    topViewConfig,
    hud,
  );
}

/**
 * Advance world/scene state (physics, gravity, trajectories, cameras).
 *
 * Responsibilities kept here:
 *  - Orchestrate per-frame simulation steps in the correct order
 *  - Keep scene objects in sync with simulated world entities
 */
function stepSimulation(dtSeconds: number, input: ControlInput): void {
  stepPhysics(dtSeconds, input);

  syncShipsToSceneObjects(world, scene);
  syncPlanetsToSceneObjects(world, scene);
  syncStarsToSceneObjects(world, scene);
  syncLightsToStars(world, scene);

  updateTrajectories(dtSeconds);
  updateCameras();
}

/**
 * Adapt the main ship and its pilot view into the data structures
 * used by the controls module.
 */
function makeControlledBodyState(ship: Ship): ControlledBodyState {
  return {
    frame: ship.frame,
    velocity: ship.velocity,
  };
}

function writeBackControlledBodyState(
  ship: Ship,
  body: ControlledBodyState,
): void {
  ship.frame = body.frame;
  ship.velocity = body.velocity;
}

/**
 * Advance physical simulation only (orientation, forces, gravity).
 */
function stepPhysics(dtSeconds: number, input: ControlInput): void {
  profilerInstance.run("GAME", "physics", () => {
    updateShipOrientationFromControls(dtSeconds, input);
    updatePilotCameraOffset(dtSeconds, input);
    integrateForcesAndGravity(dtSeconds, input);
  });
}

/**
 * Handles control-input-based orientation updates for the controlled ship.
 * Also updates the persistent control state and pilot view look state.
 */
function updateShipOrientationFromControls(
  dtSeconds: number,
  input: ControlInput,
): void {
  const ship = getShipById(world, mainShipId);
  const bodyState = makeControlledBodyState(ship);

  updateBodyOrientationFromInput(dtSeconds, input, controlState, bodyState);

  writeBackControlledBodyState(ship, bodyState);
}

/**
 * Handles forces and orbital physics:
 *  - Maintaining GravityState
 *  - Applying thrust into the ship's body velocity
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

  // 1) Apply thrust to the main ship's body velocity in gravityState.
  const controlledShip = getShipById(world, mainShipId);

  const shipBody = gravityState.bodies[mainShipBodyIndex];

  const bodyState: ControlledBodyState = {
    frame: controlledShip.frame,
    velocity: shipBody.velocity,
  };

  applyThrustToVelocity(gravityDt, input, controlState, bodyState);

  shipBody.velocity = bodyState.velocity;

  // 2) Step gravity (pure domain: updates velocities and returns new positions).
  const domainWorld: DomainWorld = world;
  const { nextState, positions } = gravityEngine.step(
    gravityDt,
    domainWorld,
    gravityState,
  );

  gravityState = nextState;

  // 3) Apply positions back into AppWorld via bindings.
  applyGravityPositionsToWorld(positions);

  // 4) Sync ship velocities in WorldState from gravityState so debug & HUD see them.
  syncShipVelocitiesFromGravity();
}

function applyGravityPositionsToWorld(positions: Vec3[]): void {
  const bindings = gravityState.bindings;
  const n = bindings.length;
  if (positions.length !== n) {
    throw new Error(
      `applyGravityPositionsToWorld: position count ${positions.length} does not match bindings ${n}`,
    );
  }

  for (let i = 0; i < n; i++) {
    const binding = bindings[i];
    const pos = positions[i];

    switch (binding.kind) {
      case "ship": {
        const ship = world.shipBodies[binding.shipIndex];
        ship.position = { ...pos };
        break;
      }
      case "planet": {
        const planet = world.planets[binding.planetIndex];
        planet.position = { ...pos };
        break;
      }
      case "star": {
        const star = world.stars[binding.starIndex];
        star.position = { ...pos };
        break;
      }
    }
  }
}

function syncShipVelocitiesFromGravity(): void {
  for (const binding of gravityState.bindings) {
    if (binding.kind !== "ship") continue;

    const body = gravityState.bodies[binding.shipIndex];
    if (!body) continue;

    const ship = world.shipBodies[binding.shipIndex];
    ship.velocity = { ...body.velocity };
    ship.speed = vec3.length(ship.velocity);
  }
}

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
function updateTrajectories(dtSeconds: number): void {
  const sampleInterval = 1.0; // seconds

  if (paused) {
    return;
  }

  accumTime += dtSeconds;

  if (accumTime >= sampleInterval) {
    appendShipTrajectoryPoint();
    appendPlanetTrajectories();
    accumTime = 0;
  }
}

/**
 * Update all camera positions / orientations.
 */
function updateCameras(): void {
  const mainShip = getShipById(world, mainShipId);

  setCameraRelativeToShip(
    pilotCameraId,
    mainShip,
    pilotCameraLocalOffset,
    frameFromShipForPilot,
  );

  setCameraRelativeToShip(
    topCameraId,
    mainShip,
    { x: 0, y: 0, z: 50 },
    frameFromShipForTop,
  );
}

function frameFromShipForPilot(ship: Ship): LocalFrame {
  const base = ship.frame;
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

function frameFromShipForTop(ship: Ship): LocalFrame {
  const { right, forward, up } = ship.frame;
  return {
    right: vec3.clone(right),
    forward: vec3.scale(up, -1),
    up: vec3.clone(forward),
  };
}

function setCameraRelativeToShip(
  cameraId: string,
  ship: Ship,
  localOffset: Vec3,
  frameFromShip: (ship: Ship) => LocalFrame,
): void {
  const camera = getDomainCameraById(world, cameraId);
  const { right, forward, up } = ship.frame;

  const worldOffset = vec3.add3(
    vec3.scale(right, localOffset.x),
    vec3.scale(forward, localOffset.y),
    vec3.scale(up, localOffset.z),
  );

  camera.position = vec3.add(ship.position, worldOffset);
  camera.frame = frameFromShip(ship);
}

function appendShipTrajectoryPoint(): void {
  const mainShip = getShipById(world, mainShipId);
  const pathObj = scene.objects.find((o) => o.id === "path:ship:main");
  if (pathObj) {
    appendPointToPolylineMesh(pathObj.mesh, mainShip.position);
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
    shipBodies: world.shipBodies,
    cameras: world.cameras,
    planets: world.planets,
    planetPhysics: world.planetPhysics,
    stars: world.stars,
    starPhysics: world.starPhysics,
  };
}
