import { resolveCollisions } from "../domain/collisions";
import type { GravityEngine, World } from "../domain/domainPorts";
import { buildInitialGravityState } from "../domain/gravityState";
import type {
  ControlInput,
  ControlledBodyState,
  PropulsionCommand,
  RcsCommand,
  SimControlState,
  ThrustCommand,
} from "./controlPorts";
import {
  getMainThrustCommandInto,
  getRcsCommandInto,
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
  resolvePropulsionCommandWithPlugins,
  updateControlState,
  updateControlledBodyAngularVelocityFromInput,
} from "./controls";
import {
  applyCelestialSpin,
  applyControlledBodyRotation,
  applyGravity,
  applyRcsTranslation,
  applyThrust,
} from "./physics";
import type { ControlPlugin, SimulationPlugin } from "./pluginPorts";
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
    propulsionCommand = getPropulsionCommandForTick(
      dtMillis,
      controlInput,
      simControlState,
      worldAndScene.mainControlledBody,
      worldAndScene.world,
      controlPlugins,
    );
    updateControlledBodyAngularVelocityFromInput(
      dtMillis,
      worldAndScene.mainControlledBody,
      controlInput,
      simControlState,
      worldAndScene.world,
      controlPlugins,
    );
    applyControlledBodyRotation(dtMillis, worldAndScene.mainControlledBody);
    applyThrust(
      dtMillis,
      worldAndScene.mainControlledBody,
      propulsionCommand.main,
    );
    applyRcsTranslation(
      dtMillis,
      worldAndScene.mainControlledBody,
      propulsionCommand.rcs,
    );
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

let manualPropulsionCommand: PropulsionCommand = {
  main: { forward: 0 },
  rcs: { right: 0 },
};

function getPropulsionCommandForTick(
  dtMillis: number,
  controlInput: ControlInput,
  controlState: SimControlState,
  ship: ControlledBodyState,
  world: World,
  controlPlugins: ControlPlugin[],
): PropulsionCommand {
  updateControlState(controlInput, controlState, controlPlugins);
  getMainThrustCommandInto(
    manualPropulsionCommand.main,
    controlInput,
    controlState,
  );
  getRcsCommandInto(manualPropulsionCommand.rcs, controlInput);
  return resolvePropulsionCommandWithPlugins(
    dtMillis,
    controlInput,
    ship,
    world,
    manualPropulsionCommand,
    maxThrustAcceleration,
    maxRcsTranslationAcceleration,
    controlPlugins,
  );
}

function getRenderedThrustLevel(
  thrustCommand: ThrustCommand,
  controlState: SimControlState,
): number {
  if (thrustCommand.forward === 0) {
    return 0;
  }
  return thrustCommand.forward > 0
    ? controlState.thrustLevel
    : -controlState.thrustLevel;
}

function getRenderedRcsLevel(rcsCommand: RcsCommand): number {
  if (rcsCommand.right === 0) {
    return 0;
  }
  return rcsCommand.right;
}
