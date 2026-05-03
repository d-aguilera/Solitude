import { resolveCollisions } from "../domain/collisions";
import type { GravityEngine } from "../domain/domainPorts";
import { buildInitialGravityState } from "../domain/gravityState";
import type { ControlInput } from "./controlPorts";
import { applyCelestialSpin, applyGravity } from "./physics";
import type { SimulationPlugin } from "./pluginPorts";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "./runtimePorts";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gravityEngine: GravityEngine,
  worldAndScene: WorldAndScene,
  simulationPlugins: SimulationPlugin[] = [],
): TickCallback {
  const gravityState = buildInitialGravityState(worldAndScene.world);
  const simulationPhaseParams = {
    controlInput: {} as ControlInput,
    dtMillis: 0,
    dtMillisSim: 0,
    mainFocus: worldAndScene.mainFocus,
    output: {} as TickOutput,
    world: worldAndScene.world,
  };

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    simulationPhaseParams.controlInput = params.controlInput;
    simulationPhaseParams.dtMillis = params.dtMillis;
    simulationPhaseParams.dtMillisSim = params.dtMillisSim;
    simulationPhaseParams.output = output;
    output.currentThrustLevel = 0;
    output.currentRcsLevel = 0;

    applyBeforeVehicleDynamics(simulationPlugins, simulationPhaseParams);
    applyVehicleDynamics(simulationPlugins, simulationPhaseParams);
    applyAfterVehicleDynamics(simulationPlugins, simulationPhaseParams);

    applyBeforeGravity(simulationPlugins, simulationPhaseParams);
    applyGravity(params.dtMillisSim, gravityEngine, gravityState);
    applyAfterGravity(simulationPlugins, simulationPhaseParams);

    resolveCollisions(worldAndScene.world);
    applyAfterCollisions(simulationPlugins, simulationPhaseParams);

    applyCelestialSpin(params.dtMillisSim, worldAndScene.world);
    applyAfterSpin(simulationPlugins, simulationPhaseParams);
  };
}

type SimulationPhaseParams = Parameters<
  NonNullable<SimulationPlugin["beforeVehicleDynamics"]>
>[0];

function applyBeforeVehicleDynamics(
  plugins: SimulationPlugin[],
  params: SimulationPhaseParams,
): void {
  for (const plugin of plugins) plugin.beforeVehicleDynamics?.(params);
}

function applyAfterVehicleDynamics(
  plugins: SimulationPlugin[],
  params: SimulationPhaseParams,
): void {
  for (const plugin of plugins) plugin.afterVehicleDynamics?.(params);
}

function applyVehicleDynamics(
  plugins: SimulationPlugin[],
  params: SimulationPhaseParams,
): void {
  for (const plugin of plugins) plugin.updateVehicleDynamics?.(params);
}

function applyBeforeGravity(
  plugins: SimulationPlugin[],
  params: SimulationPhaseParams,
): void {
  for (const plugin of plugins) plugin.beforeGravity?.(params);
}

function applyAfterGravity(
  plugins: SimulationPlugin[],
  params: SimulationPhaseParams,
): void {
  for (const plugin of plugins) plugin.afterGravity?.(params);
}

function applyAfterCollisions(
  plugins: SimulationPlugin[],
  params: SimulationPhaseParams,
): void {
  for (const plugin of plugins) plugin.afterCollisions?.(params);
}

function applyAfterSpin(
  plugins: SimulationPlugin[],
  params: SimulationPhaseParams,
): void {
  for (const plugin of plugins) plugin.afterSpin?.(params);
}
