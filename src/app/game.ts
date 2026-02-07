import type { GravityEngine, GravityState } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
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
import {
  updateControlState,
  updateShipOrientationFromControls,
} from "./controls.js";
import { buildGravityBindings, applyForcesAndGravity } from "./physics.js";
import { updateSceneGraph } from "./scene.js";
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
    thrustLevel: 0,
  };

  const simState: SimulationState = {
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
    pilotCameraLocalOffset: vec3.create(0, 1.7, 1.1),
    topCameraLocalOffset: vec3.create(0, 0, 50),
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
    controlInput,
    nowMs,
    paused,
  }: TickParams): Readonly<TickOutput> => {
    if (!initialized) {
      lastTimeMs = nowMs - 1;
      initialized = true;
    }

    const dtMs = paused ? 0 : nowMs - lastTimeMs;
    const dtSeconds = dtMs / 1000;
    lastTimeMs = nowMs;

    const currentThrustPercent = updateControlState(
      controlInput,
      simControlState,
    );

    const currentThrustLevel =
      currentThrustPercent === 0
        ? 0
        : currentThrustPercent > 0
          ? simControlState.thrustLevel
          : -simControlState.thrustLevel;

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
      currentThrustPercent,
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
      currentThrustLevel,
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
