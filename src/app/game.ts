import { resolveCollisions } from "../domain/collisions";
import type { GravityEngine } from "../domain/domainPorts";
import { buildInitialGravityState } from "../domain/gravityState";
import type {
  ControlInput,
  PropulsionCommand,
  SimControlState,
} from "./controlPorts";
import { applyCelestialSpin, applyGravity } from "./physics";
import type { ControlPlugin, SimulationPlugin } from "./pluginPorts";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "./runtimePorts";
import {
  applySpacecraftVehicleDynamics,
  getRenderedRcsLevel,
  getRenderedThrustLevel,
} from "./spacecraftVehicleDynamics";

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
  let propulsionCommand: PropulsionCommand;

  const simControlState: SimControlState = {
    thrustLevel,
  };

  const gravityState = buildInitialGravityState(worldAndScene.world);
  const simulationPhaseParams = {
    controlInput: {} as ControlInput,
    controlState: simControlState,
    dtMillis: 0,
    dtMillisSim: 0,
    mainFocus: worldAndScene.mainFocus,
    mainControlledBody: worldAndScene.mainControlledBody,
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

    applyBeforeVehicleDynamics(simulationPlugins, simulationPhaseParams);
    propulsionCommand = applySpacecraftVehicleDynamics({
      controlInput,
      controlPlugins,
      controlState: simControlState,
      dtMillis,
      mainControlledBody: worldAndScene.mainControlledBody,
      world: worldAndScene.world,
    });
    applyAfterVehicleDynamics(simulationPlugins, simulationPhaseParams);

    applyBeforeGravity(simulationPlugins, simulationPhaseParams);
    applyGravity(dtMillisSim, gravityEngine, gravityState);
    applyAfterGravity(simulationPlugins, simulationPhaseParams);

    resolveCollisions(worldAndScene.world);
    applyAfterCollisions(simulationPlugins, simulationPhaseParams);

    applyCelestialSpin(dtMillisSim, worldAndScene.world);
    applyAfterSpin(simulationPlugins, simulationPhaseParams);

    output.currentThrustLevel = getRenderedThrustLevel(
      propulsionCommand.main,
      simControlState,
    );

    output.currentRcsLevel = getRenderedRcsLevel(propulsionCommand.rcs);
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
