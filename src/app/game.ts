import type { GravityEngine, GravityState } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { getShipById } from "../domain/worldLookup.js";
import type {
  GravityBodyBinding,
  SceneState,
  SimControlState,
  SimulationState,
} from "./appInternals.js";
import type {
  SceneControlState,
  TickCallback,
  TickOutput,
  TickParams,
} from "./appPorts.js";
import { updateShipOrientationFromControls } from "./controls.js";
import { buildGravityBindings, applyForcesAndGravity } from "./physics.js";
import { mutateScene as updateSceneGraph } from "./scene.js";
import { updateControlState } from "./sim.js";
import { createInitialSceneAndWorld } from "./worldSetup.js";

/**
 * App‑core game entry.
 */
export function startGame(gravityEngine: GravityEngine): TickCallback {
  const x = createInitialSceneAndWorld();

  let gravityBindings: GravityBodyBinding[] = buildGravityBindings(x.world);

  // Determine which gravity body corresponds to the main ship.
  let mainShipBodyIndex: number = gravityBindings.findIndex(
    (b) => b.kind === "ship" && b.id === x.mainShipId,
  );

  if (mainShipBodyIndex === -1) {
    throw new Error(
      `startGame: main ship body not found in gravity bindings for id=${x.mainShipId}`,
    );
  }

  const mainShip = getShipById(x.world, x.mainShipId);

  const gravityState: GravityState = buildInitialGravityState(x.world);

  const mainShipBodyState = gravityState.bodies[mainShipBodyIndex];

  const simControlState: SimControlState = {
    alignToVelocity: false,
    thrustPercent: 0,
  };

  const simState: SimulationState = {
    currentThrustPercent: 0,
    gravityBindings,
    gravityEngine,
    gravityState,
    mainShip,
    mainShipBodyState,
    world: x.world,
  };

  const sceneControlState: SceneControlState = {
    look: {
      azimuth: 0,
      elevation: 0,
    },
    pilotCameraLocalOffset: { x: 0, y: 1.7, z: 1.1 },
  };

  const sceneState: SceneState = {
    pilotCamera: x.pilotCamera,
    planetPathMappings: x.planetPathMappings,
    planetTrajectories: x.planetTrajectories,
    scene: x.scene,
    speedMps: 0,
    topCamera: x.topCamera,
    trajectoryAccumTime: 0,
  };

  let lastTimeMs: number;
  let initialized = false;

  /**
   * Per‑frame update/render entry called by the outer loop.
   */
  return ({
    nowMs,
    controlInput,
    paused,
  }: TickParams): Readonly<TickOutput> => {
    if (!initialized) {
      lastTimeMs = nowMs - 1;
      initialized = true;
    }

    const dtMs = nowMs - lastTimeMs;
    const dtSeconds = paused ? 0 : dtMs / 1000;
    lastTimeMs = nowMs;

    simState.currentThrustPercent = updateControlState(
      controlInput,
      simControlState,
    );

    updateShipOrientationFromControls(
      dtSeconds,
      simState.mainShip,
      controlInput,
      simControlState,
    );

    applyForcesAndGravity(
      dtSeconds,
      x.world,
      mainShip,
      mainShipBodyState,
      simState.currentThrustPercent,
      gravityEngine,
      gravityState,
      gravityBindings,
    );

    updateSceneGraph(
      dtSeconds,
      sceneState,
      sceneControlState,
      simState,
      controlInput,
    );

    return {
      currentThrustPercent: simState.currentThrustPercent,
      fps: paused ? 0 : 1 / dtSeconds,
      mainShip,
      pilotCamera: sceneState.pilotCamera,
      pilotCameraLocalOffset: sceneControlState.pilotCameraLocalOffset,
      scene: sceneState.scene,
      speedMps: sceneState.speedMps,
      topCamera: sceneState.topCamera,
    };
  };
}
