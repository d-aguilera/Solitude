import { resolveCollisions } from "../domain/collisions";
import type { GravityEngine } from "../domain/domainPorts";
import { buildInitialGravityState } from "../domain/gravityState";
import type { ControlInput, SimControlState } from "./controlPorts";
import { applyCelestialSpin, applyGravity } from "./physics";
import type { ControlPlugin, SimulationPlugin } from "./pluginPorts";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "./runtimePorts";
import { createSpacecraftVehicleDynamicsPlugin } from "./spacecraftVehicleDynamics";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gravityEngine: GravityEngine,
  thrustLevel: number,
  worldAndScene: WorldAndScene,
  controlPlugins: ControlPlugin[] = [],
  simulationPlugins: SimulationPlugin[] = [],
): TickCallback {
  const simControlState: SimControlState = {
    thrustLevel,
  };
  const activeSimulationPlugins: SimulationPlugin[] = [
    createSpacecraftVehicleDynamicsPlugin(controlPlugins),
    ...simulationPlugins,
  ];

  const gravityState = buildInitialGravityState(worldAndScene.world);
  const simulationPhaseParams = {
    controlInput: {} as ControlInput,
    controlState: simControlState,
    dtMillis: 0,
    dtMillisSim: 0,
    mainFocus: worldAndScene.mainFocus,
    mainControlledBody: worldAndScene.mainControlledBody,
    output: {} as TickOutput,
    world: worldAndScene.world,
  };

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    const { controlInput, dtMillis, dtMillisSim } = params;
    simulationPhaseParams.controlInput = controlInput;
    simulationPhaseParams.dtMillis = dtMillis;
    simulationPhaseParams.dtMillisSim = dtMillisSim;
    simulationPhaseParams.output = output;
    output.currentThrustLevel = 0;
    output.currentRcsLevel = 0;

    applyBeforeVehicleDynamics(activeSimulationPlugins, simulationPhaseParams);
    applyVehicleDynamics(activeSimulationPlugins, simulationPhaseParams);
    applyAfterVehicleDynamics(activeSimulationPlugins, simulationPhaseParams);

    applyBeforeGravity(activeSimulationPlugins, simulationPhaseParams);
    applyGravity(dtMillisSim, gravityEngine, gravityState);
    applyAfterGravity(activeSimulationPlugins, simulationPhaseParams);

    resolveCollisions(worldAndScene.world);
    applyAfterCollisions(activeSimulationPlugins, simulationPhaseParams);

    applyCelestialSpin(dtMillisSim, worldAndScene.world);
    applyAfterSpin(activeSimulationPlugins, simulationPhaseParams);
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
