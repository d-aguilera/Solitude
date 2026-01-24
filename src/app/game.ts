import type {
  GravityEngine,
  GravityState,
  LocalFrame,
  PlanetPathMapping,
  Profiler,
  ShipBody,
  Vec3,
  World,
} from "../domain/domainPorts.js";
import type { GravityBodyBinding } from "./appPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { rotateFrameAroundAxis } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type { ControlledBodyState } from "./appInternals.js";
import type {
  ControlInput,
  DomainCameraPose,
  GameState,
  ProfilerController,
  TickCallback,
} from "./appPorts.js";
import {
  applyThrustToVelocity,
  updateBodyOrientationFromInput,
  createInitialControlState,
} from "./controls.js";
import { updateFPS } from "./fps.js";
import { pauseControl, paused } from "./pause.js";
import {
  rebuildPlanetPathMesh,
  updatePlanetTrajectory,
  type PlanetTrajectory,
} from "./planetTrajectories.js";
import { appendPointToPolylineMesh } from "./trajectory.js";
import { getShipById } from "./worldLookup.js";
import {
  createInitialSceneAndWorld,
  rotateCelestialBodies,
  syncShipsToSceneObjects,
  syncPlanetsToSceneObjects,
  syncStarsToSceneObjects,
  syncLightsToStars,
} from "./worldSetupApp.js";

let gameState: GameState = {} as GameState;

let planetPathMappings: PlanetPathMapping[];
let planetTrajectories: PlanetTrajectory[];

let gravityState: GravityState;
let gravityBindings: GravityBodyBinding[];
let gravityEngine: GravityEngine;
let trajectoryAccumTime = 0;
let mainShipBodyIndex: number = -1;

let profilerController: ProfilerController;

/**
 * App‑core game entry.
 */
export function startGame(deps: {
  gravityEngine: GravityEngine;
  profiler: Profiler;
  profilerController: ProfilerController;
}): TickCallback {
  gravityEngine = deps.gravityEngine;
  profilerController = deps.profilerController;

  const x = createInitialSceneAndWorld();

  gameState.scene = x.scene;
  gameState.world = x.world;
  gameState.mainShipId = x.mainShipId;
  gameState.topCamera = x.topCamera;
  gameState.pilotCamera = x.pilotCamera;
  gameState.controlState = createInitialControlState();
  gameState.pilotCameraLocalOffset = { x: 0, y: 1.7, z: 1.1 };

  planetPathMappings = x.planetPathMappings;
  planetTrajectories = x.planetTrajectories;

  gravityState = buildInitialGravityState(gameState.world);
  gravityBindings = buildGravityBindings(gameState.world);

  // Determine which gravity body corresponds to the main ship.
  mainShipBodyIndex = gravityBindings.findIndex(
    (b) => b.kind === "ship" && b.id === gameState.mainShipId,
  );

  if (mainShipBodyIndex === -1) {
    throw new Error(
      `startGame: main ship body not found in gravity bindings for id=${gameState.mainShipId}`,
    );
  }

  let lastTimeMs: number;
  let initialized = false;

  /**
   * Per‑frame update/render entry called by the outer loop.
   */
  return ({ nowMs, controlInput, envInput, profilingEnabled }): GameState => {
    if (!initialized) {
      lastTimeMs = nowMs;
      initialized = true;
      return gameState;
    }

    const dtMs = nowMs - lastTimeMs;
    const dtSeconds = paused ? 0 : dtMs / 1000;
    lastTimeMs = nowMs;

    pauseControl(envInput.pauseToggle);

    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    updateFPS(nowMs);

    stepSimulation(dtSeconds, controlInput);

    profilerController.flush();

    return gameState;
  };
}

function buildGravityBindings(world: World): GravityBodyBinding[] {
  const bindings: GravityBodyBinding[] = [];

  // Ships
  for (let i = 0; i < world.shipBodies.length; i++) {
    const ship = world.shipBodies[i];
    bindings.push({
      id: ship.id,
      kind: "ship",
      shipIndex: i,
      planetIndex: -1,
      starIndex: -1,
    });
  }

  // Planets
  for (let i = 0; i < world.planets.length; i++) {
    const planet = world.planets[i];
    bindings.push({
      id: planet.id,
      kind: "planet",
      shipIndex: -1,
      planetIndex: i,
      starIndex: -1,
    });
  }

  // Stars
  for (let i = 0; i < world.stars.length; i++) {
    const star = world.stars[i];
    bindings.push({
      id: star.id,
      kind: "star",
      shipIndex: -1,
      planetIndex: -1,
      starIndex: i,
    });
  }

  return bindings;
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

  syncShipsToSceneObjects(gameState.world, gameState.scene);
  syncPlanetsToSceneObjects(gameState.world, gameState.scene);
  syncStarsToSceneObjects(gameState.world, gameState.scene);
  syncLightsToStars(gameState.world, gameState.scene);

  rotateCelestialBodies(gameState.scene, dtSeconds);
  updateTrajectories(dtSeconds);

  updateCameras();
}

/**
 * Adapt the main ship and its pilot view into the data structures
 * used by the controls module.
 */
function makeControlledBodyState(ship: ShipBody): ControlledBodyState {
  return {
    frame: ship.frame,
    velocity: ship.velocity,
  };
}

function writeBackControlledBodyState(
  ship: ShipBody,
  body: ControlledBodyState,
): void {
  ship.frame = body.frame;
  ship.velocity = body.velocity;
}

/**
 * Advance physical simulation only (orientation, forces, gravity).
 */
function stepPhysics(dtSeconds: number, input: ControlInput): void {
  updateShipOrientationFromControls(dtSeconds, input);
  updatePilotCameraOffset(dtSeconds, input);
  integrateForcesAndGravity(dtSeconds, input);
}

/**
 * Handles control-input-based orientation updates for the controlled ship.
 * Also updates the persistent control state and pilot view look state.
 */
function updateShipOrientationFromControls(
  dtSeconds: number,
  input: ControlInput,
): void {
  const ship = getShipById(gameState.world, gameState.mainShipId);
  const bodyState = makeControlledBodyState(ship);

  updateBodyOrientationFromInput(
    dtSeconds,
    input,
    gameState.controlState,
    bodyState,
  );

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

  if (gravityDt === 0) {
    return;
  }

  // 1) Apply thrust to the main ship's body velocity inside gravityState.
  const controlledShip = getShipById(gameState.world, gameState.mainShipId);

  const shipBody = gravityState.bodies[mainShipBodyIndex];

  const bodyState: ControlledBodyState = {
    frame: controlledShip.frame,
    velocity: shipBody.velocity,
  };

  applyThrustToVelocity(gravityDt, input, gameState.controlState, bodyState);

  shipBody.velocity = bodyState.velocity;

  // 2) Step gravity (pure domain: updates velocities and positions).
  gravityState = gravityEngine.step(gravityDt, gravityState);

  // 3) Apply positions back into AppWorld via bindings.
  applyGravityPositionsToWorld(gravityState.positions);

  // 4) Sync ship velocities in WorldState from gravityState so debug & HUD see them.
  syncShipVelocitiesFromGravity();
}

function applyGravityPositionsToWorld(positions: Vec3[]): void {
  const n = gravityBindings.length;
  if (positions.length !== n) {
    throw new Error(
      `applyGravityPositionsToWorld: position count ${positions.length} does not match bindings ${n}`,
    );
  }

  for (let i = 0; i < n; i++) {
    const binding = gravityBindings[i];
    const pos = positions[i];

    switch (binding.kind) {
      case "ship": {
        const ship = gameState.world.shipBodies[binding.shipIndex];
        ship.position = { ...pos };
        break;
      }
      case "planet": {
        const planet = gameState.world.planets[binding.planetIndex];
        planet.position = { ...pos };
        break;
      }
      case "star": {
        const star = gameState.world.stars[binding.starIndex];
        star.position = { ...pos };
        break;
      }
    }
  }
}

function syncShipVelocitiesFromGravity(): void {
  for (const binding of gravityBindings) {
    if (binding.kind !== "ship") continue;

    const bodyIndex = gravityState.bodies.findIndex((b) => b.id === binding.id);
    if (bodyIndex === -1) {
      continue;
    }

    const body = gravityState.bodies[bodyIndex];
    const ship = gameState.world.shipBodies[binding.shipIndex];

    ship.velocity = { ...body.velocity };
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

  trajectoryAccumTime += dtSeconds;

  while (trajectoryAccumTime >= sampleInterval) {
    appendShipTrajectoryPoint();
    appendPlanetTrajectories();
    trajectoryAccumTime -= sampleInterval;
  }
}

/**
 * Update all camera positions / orientations.
 */
function updateCameras(): void {
  const mainShip = getShipById(gameState.world, gameState.mainShipId);

  setCameraRelativeToShip(
    gameState.pilotCamera,
    mainShip,
    gameState.pilotCameraLocalOffset,
    frameFromShipForPilot,
  );

  setCameraRelativeToShip(
    gameState.topCamera,
    mainShip,
    { x: 0, y: 0, z: 50 },
    frameFromShipForTop,
  );
}

function frameFromShipForPilot(ship: ShipBody): LocalFrame {
  const base = ship.frame;
  const { azimuth, elevation } = gameState.controlState.look;

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

function frameFromShipForTop(ship: ShipBody): LocalFrame {
  const { right, forward, up } = ship.frame;
  return {
    right: vec3.clone(right),
    forward: vec3.scale(up, -1),
    up: vec3.clone(forward),
  };
}

function setCameraRelativeToShip(
  pose: DomainCameraPose,
  ship: ShipBody,
  localOffset: Vec3,
  frameFromShip: (ship: ShipBody) => LocalFrame,
): void {
  const { right, forward, up } = ship.frame;

  const worldOffset = vec3.add3(
    vec3.scale(right, localOffset.x),
    vec3.scale(forward, localOffset.y),
    vec3.scale(up, localOffset.z),
  );

  pose.position = vec3.add(ship.position, worldOffset);
  pose.frame = frameFromShip(ship);
}

function appendShipTrajectoryPoint(): void {
  const mainShip = getShipById(gameState.world, gameState.mainShipId);
  const pathObj = gameState.scene.objects.find(
    (o) => o.id === "path:ship:main",
  );
  if (pathObj) {
    appendPointToPolylineMesh(pathObj.mesh, mainShip.position);
  }
}

function appendPlanetTrajectories(): void {
  for (const mapping of planetPathMappings) {
    const bodyObj = gameState.scene.objects.find(
      (o) => o.id === mapping.planetId,
    );
    const pathObj = gameState.scene.objects.find(
      (o) => o.id === mapping.pathId,
    );
    if (!bodyObj || !pathObj) continue;

    const trajectory = planetTrajectories.find(
      (t) => t.planetId === mapping.planetId,
    );
    if (!trajectory) continue;

    // 1) Update trajectory tiers (1 second step implied)
    updatePlanetTrajectory(trajectory, bodyObj.position);

    // 2) Rebuild mesh from tiers
    rebuildPlanetPathMesh(trajectory, pathObj.mesh);
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

  gameState.pilotCameraLocalOffset = {
    x: gameState.pilotCameraLocalOffset.x + dx * dtSeconds,
    y: gameState.pilotCameraLocalOffset.y + dy * dtSeconds,
    z: gameState.pilotCameraLocalOffset.z + dz * dtSeconds,
  };
}
