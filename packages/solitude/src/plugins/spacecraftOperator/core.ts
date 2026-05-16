import type { ControlInput } from "@solitude/engine/app/controlPorts";
import {
  applyControlledBodyRotation,
  createPhysicsWorkspace,
  type PhysicsWorkspace,
} from "@solitude/engine/app/physics";
import type {
  ControlPlugin,
  PluginCapabilityRegistry,
  SimulationPlugin,
} from "@solitude/engine/app/pluginPorts";
import type {
  ControlledBody,
  World,
} from "@solitude/engine/domain/domainPorts";
import { vec3 } from "@solitude/engine/domain/vec3";
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
  physicsWorkspace?: PhysicsWorkspace;
  propulsionResolvers: readonly SpacecraftPropulsionResolver[];
  world: World;
}

export function applySpacecraftVehicleDynamics(
  params: SpacecraftVehicleDynamicsParams,
): SpacecraftPropulsionCommand {
  const propulsionCommand = getPropulsionCommandForTick(
    params.dtMillis,
    params.controlInput,
    params.controlState,
    params.controlledBody,
    params.world,
    params.controlPlugins,
    params.propulsionResolvers,
  );
  updateControlledBodyAngularVelocityFromInput(
    params.dtMillis,
    params.controlledBody,
    params.controlInput,
    params.controlState,
    params.world,
    params.controlPlugins,
  );
  applyControlledBodyRotation(
    params.dtMillis,
    params.controlledBody,
    params.physicsWorkspace,
  );
  applyThrust(
    params.dtMillis,
    params.controlledBody,
    propulsionCommand.main,
    maxThrustAcceleration,
  );
  applyRcsTranslation(
    params.dtMillis,
    params.controlledBody,
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
  const controlStatesByEntityId = new Map<string, SpacecraftControlState>();
  const propulsionResolvers =
    getSpacecraftPropulsionResolvers(capabilityRegistry);
  const physicsWorkspace = createPhysicsWorkspace();

  return {
    updateVehicleDynamics: (params) => {
      const controlState = getControlStateForEntity(
        controlStatesByEntityId,
        params.mainFocus.entityId,
      );
      const propulsionCommand = applySpacecraftVehicleDynamics({
        controlInput: params.controlInput,
        controlPlugins,
        controlState,
        controlledBody: params.mainFocus.controlledBody,
        dtMillis: params.dtMillis,
        physicsWorkspace,
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

function getControlStateForEntity(
  statesByEntityId: Map<string, SpacecraftControlState>,
  entityId: string,
): SpacecraftControlState {
  let controlState = statesByEntityId.get(entityId);
  if (!controlState) {
    controlState = { thrustLevel: 1 };
    statesByEntityId.set(entityId, controlState);
  }
  return controlState;
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
