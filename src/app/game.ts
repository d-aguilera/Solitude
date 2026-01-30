import type { GravityEngine, GravityState } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { getShipById } from "../domain/worldLookup.js";
import type {
  GameState,
  GravityBodyBinding,
  TickOutput,
  TickCallback,
  PresentationState,
  SimulationState,
  SimControlState,
  TickParams,
} from "./appPorts.js";
import {
  createInitialSimControlState,
  createInitialViewControlState,
} from "./controls.js";
import { buildGravityBindings } from "./physics.js";
import { handleTick as handleTick } from "./handleTick.js";
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

  const presentationState: PresentationState = {
    pilotCamera: x.pilotCamera,
    planetPathMappings: x.planetPathMappings,
    planetTrajectories: x.planetTrajectories,
    scene: x.scene,
    speedMps: 0,
    topCamera: x.topCamera,
    trajectoryAccumTime: 0,
  };

  const simControlState: SimControlState = createInitialSimControlState();

  const simState: SimulationState = {
    currentThrustPercent: 0,
    gravityBindings,
    gravityEngine,
    gravityState,
    mainShip,
    mainShipBodyState,
    world: x.world,
  };

  const viewControlState = createInitialViewControlState();

  let gameState: GameState = {
    presentationState,
    simControlState,
    simState,
    viewControlState,
  };

  let lastTimeMs: number;
  let initialized = false;

  /**
   * Per‑frame update/render entry called by the outer loop.
   */
  return ({
    nowMs,
    controlInput,
    profiler,
    paused,
  }: TickParams): Readonly<TickOutput> => {
    void profiler;

    if (!initialized) {
      lastTimeMs = nowMs - 1;
      initialized = true;
    }

    const dtMs = nowMs - lastTimeMs;
    const dtSeconds = paused ? 0 : dtMs / 1000;
    lastTimeMs = nowMs;

    handleTick(dtSeconds, gameState, controlInput);

    return {
      mainShip: mainShip,
      currentThrustPercent: simState.currentThrustPercent,
      pilotCameraLocalOffset: viewControlState.pilotCameraLocalOffset,
      pilotCamera: presentationState.pilotCamera,
      scene: presentationState.scene,
      speedMps: presentationState.speedMps,
      topCamera: presentationState.topCamera,
      fps: paused ? 0 : 1 / dtSeconds,
    };
  };
}
