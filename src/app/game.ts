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
import type { GravityBodyBinding, Scene } from "./appPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { rotateFrameAroundAxis } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type { ControlledBodyState, ControlState } from "./appInternals.js";
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
} from "./worldSetup.js";

/**
 * App‑core game entry.
 */
export function startGame(
  gravityEngine: GravityEngine,
  profiler: Profiler,
  profilerController: ProfilerController,
): TickCallback {
  void profiler;

  const x = createInitialSceneAndWorld();

  let gameState: GameState = {
    scene: x.scene,
    world: x.world,
    mainShipId: x.mainShipId,
    topCamera: x.topCamera,
    pilotCamera: x.pilotCamera,
    controlState: createInitialControlState(),
    pilotCameraLocalOffset: { x: 0, y: 1.7, z: 1.1 },
  };

  const mainShip: ShipBody = getShipById(gameState.world, gameState.mainShipId);

  let trajectoryAccumTime = 0;

  let planetPathMappings: PlanetPathMapping[] = x.planetPathMappings;
  let planetTrajectories: PlanetTrajectory[] = x.planetTrajectories;

  let gravityState: GravityState = buildInitialGravityState(gameState.world);
  let gravityBindings: GravityBodyBinding[] = buildGravityBindings(
    gameState.world,
  );

  // Determine which gravity body corresponds to the main ship.
  let mainShipBodyIndex: number = gravityBindings.findIndex(
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
  return ({
    nowMs,
    controlInput,
    envInput,
    profilingEnabled,
  }): Readonly<GameState> => {
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

    gravityState = stepSimulation(
      dtSeconds,
      gameState.world,
      gameState.scene,
      gameState.pilotCamera,
      gameState.topCamera,
      mainShip,
      mainShipBodyIndex,
      gravityEngine,
      gravityState,
      gravityBindings,
      controlInput,
      gameState.controlState,
      gameState.pilotCameraLocalOffset,
      planetPathMappings,
      planetTrajectories,
      trajectoryAccumTime,
    );

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
function stepSimulation(
  dtSeconds: number,
  world: World,
  scene: Scene,
  pilotCamera: DomainCameraPose,
  topCamera: DomainCameraPose,
  mainShip: ShipBody,
  mainShipBodyIndex: number,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
  input: ControlInput,
  controlState: ControlState,
  pilotCameraLocalOffset: Vec3,
  planetPathMappings: PlanetPathMapping[],
  planetTrajectories: PlanetTrajectory[],
  trajectoryAccumTime: number,
): GravityState {
  const newGravityState = stepPhysics(
    dtSeconds,
    world,
    mainShip,
    mainShipBodyIndex,
    gravityEngine,
    gravityState,
    gravityBindings,
    input,
    controlState,
    pilotCameraLocalOffset,
  );

  syncShipsToSceneObjects(world, scene);
  syncPlanetsToSceneObjects(world, scene);
  syncStarsToSceneObjects(world, scene);
  syncLightsToStars(world, scene);

  rotateCelestialBodies(scene, dtSeconds);

  updateTrajectories(
    dtSeconds,
    scene,
    mainShip,
    planetPathMappings,
    planetTrajectories,
    trajectoryAccumTime,
  );

  updateCameras(
    mainShip,
    pilotCamera,
    topCamera,
    pilotCameraLocalOffset,
    controlState,
  );

  return newGravityState;
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
function stepPhysics(
  dtSeconds: number,
  world: World,
  mainShip: ShipBody,
  mainShipBodyIndex: number,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
  input: ControlInput,
  controlState: ControlState,
  pilotCameraLocalOffset: Vec3,
): GravityState {
  updateShipOrientationFromControls(dtSeconds, mainShip, input, controlState);

  updatePilotCameraOffset(dtSeconds, input, pilotCameraLocalOffset);

  return integrateForcesAndGravity(
    dtSeconds,
    world,
    mainShip,
    mainShipBodyIndex,
    gravityEngine,
    gravityState,
    gravityBindings,
    input,
    controlState,
  );
}

/**
 * Handles control-input-based orientation updates for the controlled ship.
 * Also updates the persistent control state and pilot view look state.
 */
function updateShipOrientationFromControls(
  dtSeconds: number,
  ship: ShipBody,
  input: ControlInput,
  controlState: ControlState,
): void {
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
  world: World,
  controlledShip: ShipBody,
  mainShipBodyIndex: number,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
  input: ControlInput,
  controlState: ControlState,
): GravityState {
  const gravityTimeScale = 10;
  const gravityDt = dtSeconds * gravityTimeScale;

  if (gravityDt === 0) {
    return gravityState;
  }

  // 1) Apply thrust to the main ship's body velocity inside gravityState.
  const shipBodyState = gravityState.bodies[mainShipBodyIndex];

  const bodyState: ControlledBodyState = {
    frame: controlledShip.frame,
    velocity: shipBodyState.velocity,
  };

  applyThrustToVelocity(gravityDt, input, controlState, bodyState);

  shipBodyState.velocity = bodyState.velocity;

  // 2) Step gravity (updates velocities and positions).
  const newGravityState = gravityEngine.step(gravityDt, gravityState);

  // 3) Apply positions back into AppWorld via bindings.
  applyGravityPositionsToWorld(
    world,
    newGravityState.positions,
    gravityBindings,
  );

  // 4) Sync ship velocities in WorldState from gravityState so debug & HUD see them.
  syncShipVelocitiesFromGravity(world, newGravityState, gravityBindings);

  return newGravityState;
}

function applyGravityPositionsToWorld(
  world: World,
  positions: Vec3[],
  gravityBindings: GravityBodyBinding[],
): void {
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

function syncShipVelocitiesFromGravity(
  world: World,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
): void {
  for (const binding of gravityBindings) {
    if (binding.kind !== "ship") continue;

    const bodyIndex = gravityState.bodies.findIndex((b) => b.id === binding.id);
    if (bodyIndex === -1) {
      continue;
    }

    const body = gravityState.bodies[bodyIndex];
    const ship = world.shipBodies[binding.shipIndex];

    ship.velocity = { ...body.velocity };
  }
}

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
function updateTrajectories(
  dtSeconds: number,
  scene: Scene,
  mainShip: ShipBody,
  planetPathMappings: PlanetPathMapping[],
  planetTrajectories: PlanetTrajectory[],
  trajectoryAccumTime: number,
): void {
  const sampleInterval = 1.0; // seconds

  if (paused) {
    return;
  }

  trajectoryAccumTime += dtSeconds;

  while (trajectoryAccumTime >= sampleInterval) {
    appendShipTrajectoryPoint(scene, mainShip);
    appendPlanetTrajectories(scene, planetPathMappings, planetTrajectories);
    trajectoryAccumTime -= sampleInterval;
  }
}

/**
 * Update all camera positions / orientations.
 */
function updateCameras(
  mainShip: ShipBody,
  pilotCamera: DomainCameraPose,
  topCamera: DomainCameraPose,
  pilotCameraLocalOffset: Vec3,
  controlState: ControlState,
): void {
  setCameraRelativeToShip(
    pilotCamera,
    mainShip,
    pilotCameraLocalOffset,
    controlState,
    frameFromShipForPilot,
  );

  setCameraRelativeToShip(
    topCamera,
    mainShip,
    { x: 0, y: 0, z: 50 },
    controlState,
    frameFromShipForTop,
  );
}

function frameFromShipForPilot(
  ship: ShipBody,
  controlState: ControlState,
): LocalFrame {
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

function frameFromShipForTop(
  ship: ShipBody,
  controlState: ControlState,
): LocalFrame {
  void controlState;
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
  controlState: ControlState,
  frameFromShip: (ship: ShipBody, controlState: ControlState) => LocalFrame,
): void {
  const { right, forward, up } = ship.frame;

  const worldOffset = vec3.add3(
    vec3.scale(right, localOffset.x),
    vec3.scale(forward, localOffset.y),
    vec3.scale(up, localOffset.z),
  );

  pose.position = vec3.add(ship.position, worldOffset);
  pose.frame = frameFromShip(ship, controlState);
}

function appendShipTrajectoryPoint(scene: Scene, mainShip: ShipBody): void {
  const pathObj = scene.objects.find((o) => o.id === "path:ship:main");
  if (pathObj) {
    appendPointToPolylineMesh(pathObj.mesh, mainShip.position);
  }
}

function appendPlanetTrajectories(
  scene: Scene,
  planetPathMappings: PlanetPathMapping[],
  planetTrajectories: PlanetTrajectory[],
): void {
  for (const mapping of planetPathMappings) {
    const bodyObj = scene.objects.find((o) => o.id === mapping.planetId);
    const pathObj = scene.objects.find((o) => o.id === mapping.pathId);
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

function updatePilotCameraOffset(
  dtSeconds: number,
  input: ControlInput,
  pilotCameraLocalOffset: Vec3,
): void {
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

  pilotCameraLocalOffset.x += dx * dtSeconds;
  pilotCameraLocalOffset.y += dy * dtSeconds;
  pilotCameraLocalOffset.z += dz * dtSeconds;
}
