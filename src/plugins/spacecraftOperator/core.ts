import type { ControlInput } from "../../app/controlPorts";
import { applyControlledBodyRotation } from "../../app/physics";
import type {
  ControlPlugin,
  PluginCapabilityRegistry,
  SimulationPlugin,
} from "../../app/pluginPorts";
import type { ControlledBody, World } from "../../domain/domainPorts";
import { vec3 } from "../../domain/vec3";
import {
  getSpacecraftPropulsionResolvers,
  type SpacecraftPropulsionCommand,
  type SpacecraftPropulsionResolver,
  type SpacecraftRcsCommand,
  type SpacecraftThrustCommand,
} from "./capabilities";
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
  propulsionResolvers: readonly SpacecraftPropulsionResolver[];
  world: World;
}

export function applySpacecraftVehicleDynamics(
  params: SpacecraftVehicleDynamicsParams,
): SpacecraftPropulsionCommand {
  const {
    controlInput,
    controlPlugins,
    controlState,
    controlledBody,
    dtMillis,
    propulsionResolvers,
    world,
  } = params;
  const propulsionCommand = getPropulsionCommandForTick(
    dtMillis,
    controlInput,
    controlState,
    controlledBody,
    world,
    controlPlugins,
    propulsionResolvers,
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
  capabilityRegistry: PluginCapabilityRegistry,
  telemetry: SpacecraftOperatorTelemetry = createSpacecraftOperatorTelemetry(),
): SimulationPlugin {
  const controlState: SpacecraftControlState = {
    thrustLevel: 1,
  };
  const propulsionResolvers =
    getSpacecraftPropulsionResolvers(capabilityRegistry);

  return {
    updateVehicleDynamics: (params) => {
      const propulsionCommand = applySpacecraftVehicleDynamics({
        controlInput: params.controlInput,
        controlPlugins,
        controlState,
        controlledBody: params.mainFocus.controlledBody,
        dtMillis: params.dtMillis,
        propulsionResolvers,
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
  thrustCommand: SpacecraftThrustCommand,
  controlState: SpacecraftControlState,
): number {
  if (thrustCommand.forward === 0) {
    return 0;
  }
  return thrustCommand.forward > 0
    ? controlState.thrustLevel
    : -controlState.thrustLevel;
}

function getRenderedRcsLevel(rcsCommand: SpacecraftRcsCommand): number {
  if (rcsCommand.right === 0) {
    return 0;
  }
  return rcsCommand.right;
}

let manualPropulsionCommand: SpacecraftPropulsionCommand = {
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
  propulsionResolvers: readonly SpacecraftPropulsionResolver[],
): SpacecraftPropulsionCommand {
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
    propulsionResolvers,
  );
}

function applyThrust(
  dtMillis: number,
  controlledBody: ControlledBody,
  thrust: SpacecraftThrustCommand,
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
  rcs: SpacecraftRcsCommand,
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
