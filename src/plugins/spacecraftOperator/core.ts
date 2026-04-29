import type {
  ControlInput,
  PropulsionCommand,
  RcsCommand,
  SimControlState,
  ThrustCommand,
} from "../../app/controlPorts";
import {
  getMainThrustCommandInto,
  getRcsCommandInto,
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
  resolvePropulsionCommandWithPlugins,
  updateControlState,
  updateControlledBodyAngularVelocityFromInput,
} from "../../app/controls";
import {
  applyControlledBodyRotation,
  applyRcsTranslation,
  applyThrust,
} from "../../app/physics";
import type { ControlPlugin, SimulationPlugin } from "../../app/pluginPorts";
import type { ControlledBody, World } from "../../domain/domainPorts";

export interface SpacecraftVehicleDynamicsParams {
  controlInput: ControlInput;
  controlPlugins: ControlPlugin[];
  controlState: SimControlState;
  dtMillis: number;
  mainControlledBody: ControlledBody;
  world: World;
}

export function applySpacecraftVehicleDynamics(
  params: SpacecraftVehicleDynamicsParams,
): PropulsionCommand {
  const {
    controlInput,
    controlPlugins,
    controlState,
    dtMillis,
    mainControlledBody,
    world,
  } = params;
  const propulsionCommand = getPropulsionCommandForTick(
    dtMillis,
    controlInput,
    controlState,
    mainControlledBody,
    world,
    controlPlugins,
  );
  updateControlledBodyAngularVelocityFromInput(
    dtMillis,
    mainControlledBody,
    controlInput,
    controlState,
    world,
    controlPlugins,
  );
  applyControlledBodyRotation(dtMillis, mainControlledBody);
  applyThrust(dtMillis, mainControlledBody, propulsionCommand.main);
  applyRcsTranslation(dtMillis, mainControlledBody, propulsionCommand.rcs);
  return propulsionCommand;
}

export function createSpacecraftVehicleDynamicsPlugin(
  controlPlugins: ControlPlugin[],
): SimulationPlugin {
  return {
    updateVehicleDynamics: (params) => {
      const propulsionCommand = applySpacecraftVehicleDynamics({
        controlInput: params.controlInput,
        controlPlugins,
        controlState: params.controlState,
        dtMillis: params.dtMillis,
        mainControlledBody: params.mainControlledBody,
        world: params.world,
      });
      params.output.currentThrustLevel = getRenderedThrustLevel(
        propulsionCommand.main,
        params.controlState,
      );
      params.output.currentRcsLevel = getRenderedRcsLevel(
        propulsionCommand.rcs,
      );
    },
  };
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

let manualPropulsionCommand: PropulsionCommand = {
  main: { forward: 0 },
  rcs: { right: 0 },
};

function getPropulsionCommandForTick(
  dtMillis: number,
  controlInput: ControlInput,
  controlState: SimControlState,
  mainControlledBody: ControlledBody,
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
    mainControlledBody,
    world,
    manualPropulsionCommand,
    maxThrustAcceleration,
    maxRcsTranslationAcceleration,
    controlPlugins,
  );
}
