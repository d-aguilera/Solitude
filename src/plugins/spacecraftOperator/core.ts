import type {
  ControlInput,
  PropulsionCommand,
  RcsCommand,
  ThrustCommand,
} from "../../app/controlPorts";
import { applyControlledBodyRotation } from "../../app/physics";
import type { ControlPlugin, SimulationPlugin } from "../../app/pluginPorts";
import type { ControlledBody, World } from "../../domain/domainPorts";
import { vec3 } from "../../domain/vec3";
import {
  getMainThrustCommandInto,
  getRcsCommandInto,
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
  resolvePropulsionCommandWithPlugins,
  updateControlState,
  updateControlledBodyAngularVelocityFromInput,
  type SpacecraftControlState,
} from "./controlLogic";
import {
  createSpacecraftOperatorTelemetry,
  type SpacecraftOperatorTelemetry,
} from "./telemetry";

const velocityDeltaScratch = vec3.zero();

export interface SpacecraftVehicleDynamicsParams {
  controlInput: ControlInput;
  controlPlugins: ControlPlugin[];
  controlState: SpacecraftControlState;
  controlledBody: ControlledBody;
  dtMillis: number;
  world: World;
}

export function applySpacecraftVehicleDynamics(
  params: SpacecraftVehicleDynamicsParams,
): PropulsionCommand {
  const {
    controlInput,
    controlPlugins,
    controlState,
    controlledBody,
    dtMillis,
    world,
  } = params;
  const propulsionCommand = getPropulsionCommandForTick(
    dtMillis,
    controlInput,
    controlState,
    controlledBody,
    world,
    controlPlugins,
  );
  updateControlledBodyAngularVelocityFromInput(
    dtMillis,
    controlledBody,
    controlInput,
    controlState,
    world,
    controlPlugins,
  );
  applyControlledBodyRotation(dtMillis, controlledBody);
  applyThrust(
    dtMillis,
    controlledBody,
    propulsionCommand.main,
    maxThrustAcceleration,
  );
  applyRcsTranslation(
    dtMillis,
    controlledBody,
    propulsionCommand.rcs,
    maxRcsTranslationAcceleration,
  );
  return propulsionCommand;
}

export function createSpacecraftVehicleDynamicsPlugin(
  controlPlugins: ControlPlugin[],
  telemetry: SpacecraftOperatorTelemetry = createSpacecraftOperatorTelemetry(),
): SimulationPlugin {
  const controlState: SpacecraftControlState = {
    thrustLevel: 1,
  };

  return {
    updateVehicleDynamics: (params) => {
      const propulsionCommand = applySpacecraftVehicleDynamics({
        controlInput: params.controlInput,
        controlPlugins,
        controlState,
        controlledBody: params.mainFocus.controlledBody,
        dtMillis: params.dtMillis,
        world: params.world,
      });
      telemetry.currentThrustLevel = getRenderedThrustLevel(
        propulsionCommand.main,
        controlState,
      );
      telemetry.currentRcsLevel = getRenderedRcsLevel(propulsionCommand.rcs);
    },
  };
}

function getRenderedThrustLevel(
  thrustCommand: ThrustCommand,
  controlState: SpacecraftControlState,
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
  controlState: SpacecraftControlState,
  controlledBody: ControlledBody,
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
    controlledBody,
    world,
    manualPropulsionCommand,
    maxThrustAcceleration,
    maxRcsTranslationAcceleration,
    controlPlugins,
  );
}

function applyThrust(
  dtMillis: number,
  controlledBody: ControlledBody,
  thrust: ThrustCommand,
  maxThrustAcceleration: number,
): void {
  if (dtMillis === 0) return;
  if (thrust.forward === 0) return;

  const accelScale = (maxThrustAcceleration * dtMillis) / 1000;
  vec3.scaleInto(
    velocityDeltaScratch,
    accelScale * thrust.forward,
    controlledBody.frame.forward,
  );
  vec3.addInto(
    controlledBody.velocity,
    controlledBody.velocity,
    velocityDeltaScratch,
  );
}

function applyRcsTranslation(
  dtMillis: number,
  controlledBody: ControlledBody,
  rcs: RcsCommand,
  maxRcsTranslationAcceleration: number,
): void {
  if (dtMillis === 0) return;
  if (rcs.right === 0) return;

  const accelScale = (maxRcsTranslationAcceleration * dtMillis) / 1000;
  vec3.scaleInto(
    velocityDeltaScratch,
    accelScale * rcs.right,
    controlledBody.frame.right,
  );
  vec3.addInto(
    controlledBody.velocity,
    controlledBody.velocity,
    velocityDeltaScratch,
  );
}
