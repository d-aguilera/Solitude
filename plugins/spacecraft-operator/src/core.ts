import type { ExternalPluginCapabilityRegistry } from "@solitude/plugin-api/capabilities";
import type { ExternalControlPlugin } from "@solitude/plugin-api/controls";
import type { ExternalControlInput } from "@solitude/plugin-api/input";
import type { ExternalLocalEntityPredictionProvider } from "@solitude/plugin-api/local-prediction";
import { vec3, type Vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalSimulationPhaseParams,
  ExternalVehicleDynamicsPlugin,
} from "@solitude/plugin-api/simulation";
import type {
  ExternalSpacecraftAutonomousControl,
  ExternalSpacecraftPropulsionCommand,
  ExternalSpacecraftPropulsionResolver,
  ExternalSpacecraftRcsCommand,
  ExternalSpacecraftThrustCommand,
} from "@solitude/plugin-api/spacecraft";
import {
  getSpacecraftAutonomousControls,
  getSpacecraftPropulsionResolvers,
} from "@solitude/plugin-api/spacecraft";
import type { ExternalSpacecraftOperatorTelemetry } from "@solitude/plugin-api/telemetry";
import type {
  ExternalControlledBody,
  ExternalEntityId,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import {
  getMainThrustCommandInto,
  getRcsCommandInto,
  resolvePropulsionCommandWithPlugins,
  updateControlState,
  updateControlledBodyAngularVelocityFromInput,
  type SpacecraftControlState,
} from "./controlLogic";
import { localFrame } from "./localFrame";
import {
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
} from "./propulsionLimits";

const velocityDeltaScratch = vec3.zero();
const backgroundControlInput: ExternalControlInput = {};
const emptyControlPlugins: ExternalControlPlugin[] = [];
const emptyPropulsionResolvers: readonly ExternalSpacecraftPropulsionResolver[] =
  [];

interface PhysicsWorkspace {
  omegaWorld: Vec3;
  omegaAxis: Vec3;
}

function createPhysicsWorkspace(): PhysicsWorkspace {
  return {
    omegaAxis: vec3.zero(),
    omegaWorld: vec3.zero(),
  };
}

const defaultPhysicsWorkspace = createPhysicsWorkspace();

export interface SpacecraftVehicleDynamicsParams {
  controlInput: ExternalControlInput;
  controlPlugins: readonly ExternalControlPlugin[];
  controlState: SpacecraftControlState;
  controlledBody: ExternalControlledBody;
  dtMillis: number;
  physicsWorkspace?: PhysicsWorkspace;
  propulsionDtMillis: number;
  propulsionResolvers: readonly ExternalSpacecraftPropulsionResolver[];
  updateControlStateFromInput?: boolean;
  world: ExternalWorld;
}

export function applySpacecraftVehicleDynamics(
  params: SpacecraftVehicleDynamicsParams,
): ExternalSpacecraftPropulsionCommand {
  const propulsionCommand = getPropulsionCommandForTick(
    params.propulsionDtMillis,
    params.controlInput,
    params.controlState,
    params.controlledBody,
    params.world,
    params.controlPlugins,
    params.propulsionResolvers,
    params.updateControlStateFromInput ?? true,
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
    params.propulsionDtMillis,
    params.controlledBody,
    propulsionCommand.main,
    maxThrustAcceleration,
  );
  applyRcsTranslation(
    params.propulsionDtMillis,
    params.controlledBody,
    propulsionCommand.rcs,
    maxRcsTranslationAcceleration,
  );
  return propulsionCommand;
}

export function createSpacecraftVehicleDynamicsPlugin(
  controlPlugins: readonly ExternalControlPlugin[],
  capabilityRegistry: ExternalPluginCapabilityRegistry,
  telemetry: ExternalSpacecraftOperatorTelemetry = {
    currentRcsLevel: 0,
    currentThrustLevel: 0,
  },
): ExternalVehicleDynamicsPlugin {
  const controlStatesByEntityId = new Map<string, SpacecraftControlState>();
  const autonomousControls =
    getSpacecraftAutonomousControls(capabilityRegistry);
  const propulsionResolvers =
    getSpacecraftPropulsionResolvers(capabilityRegistry);
  const physicsWorkspace = createPhysicsWorkspace();
  let lastFocusedEntityId: string | null = null;

  return {
    updateVehicleDynamics: (params) => {
      if (params.controlInputsByEntityId.size > 0) {
        applyEntityControlVehicleDynamics(
          params,
          params.controlInputsByEntityId,
          controlStatesByEntityId,
          autonomousControls,
          propulsionResolvers,
          controlPlugins,
          physicsWorkspace,
          telemetry,
        );
        return;
      }

      const focusedEntityId = params.mainFocus.entityId;
      const controlState = getControlStateForEntity(
        controlStatesByEntityId,
        focusedEntityId,
      );
      if (
        lastFocusedEntityId !== null &&
        lastFocusedEntityId !== focusedEntityId
      ) {
        writeAutonomousControlInput(
          autonomousControls,
          params.controlInput,
          controlState,
        );
      }
      lastFocusedEntityId = focusedEntityId;
      const propulsionCommand = applySpacecraftVehicleDynamics({
        controlInput: params.controlInput,
        controlPlugins,
        controlState,
        controlledBody: params.mainFocus.controlledBody,
        dtMillis: params.dtMillis,
        physicsWorkspace,
        propulsionDtMillis: params.dtMillisSim,
        propulsionResolvers,
        world: params.world,
      });
      telemetry.currentThrustLevel = getRenderedThrustLevel(
        propulsionCommand.main,
        controlState,
      );
      telemetry.currentRcsLevel = getRenderedRcsLevel(propulsionCommand.rcs);

      for (const controlledBody of params.world.controllableBodies) {
        if (controlledBody.id === focusedEntityId) continue;
        const backgroundControlState = getControlStateForEntity(
          controlStatesByEntityId,
          controlledBody.id,
        );
        if (!hasAutonomousControl(autonomousControls, backgroundControlState)) {
          continue;
        }
        writeAutonomousControlInput(
          autonomousControls,
          backgroundControlInput,
          backgroundControlState,
        );
        applySpacecraftVehicleDynamics({
          controlInput: backgroundControlInput,
          controlPlugins,
          controlState: backgroundControlState,
          controlledBody,
          dtMillis: params.dtMillis,
          physicsWorkspace,
          propulsionDtMillis: params.dtMillisSim,
          propulsionResolvers,
          updateControlStateFromInput: false,
          world: params.world,
        });
      }
    },
  };
}

export function createSpacecraftLocalPredictionProvider(): ExternalLocalEntityPredictionProvider {
  const controlState: SpacecraftControlState = { thrustLevel: 1 };
  const physicsWorkspace = createPhysicsWorkspace();

  return {
    canPredictEntity: (controlledBody, world) =>
      world.controllableBodies.includes(controlledBody),
    predictEntity: (params) => {
      applySpacecraftVehicleDynamics({
        controlInput: params.controlInput,
        controlPlugins: emptyControlPlugins,
        controlState,
        controlledBody: params.controlledBody,
        dtMillis: params.dtMillis,
        physicsWorkspace,
        propulsionDtMillis: params.dtMillis,
        propulsionResolvers: emptyPropulsionResolvers,
        world: params.world,
      });
    },
    resetPrediction: () => {
      controlState.thrustLevel = 1;
    },
  };
}

function applyEntityControlVehicleDynamics(
  params: ExternalSimulationPhaseParams,
  controlInputsByEntityId: ReadonlyMap<ExternalEntityId, ExternalControlInput>,
  controlStatesByEntityId: Map<string, SpacecraftControlState>,
  autonomousControls: readonly ExternalSpacecraftAutonomousControl[],
  propulsionResolvers: readonly ExternalSpacecraftPropulsionResolver[],
  controlPlugins: readonly ExternalControlPlugin[],
  physicsWorkspace: PhysicsWorkspace,
  telemetry: ExternalSpacecraftOperatorTelemetry,
): void {
  let focusedPropulsionCommand: ExternalSpacecraftPropulsionCommand | null =
    null;
  let focusedControlState: SpacecraftControlState | null = null;

  for (const controlledBody of params.world.controllableBodies) {
    const controlState = getControlStateForEntity(
      controlStatesByEntityId,
      controlledBody.id,
    );
    const controlInput = controlInputsByEntityId.get(controlledBody.id);

    let propulsionCommand: ExternalSpacecraftPropulsionCommand | null = null;
    if (controlInput) {
      propulsionCommand = applySpacecraftVehicleDynamics({
        controlInput,
        controlPlugins,
        controlState,
        controlledBody,
        dtMillis: params.dtMillis,
        physicsWorkspace,
        propulsionDtMillis: params.dtMillisSim,
        propulsionResolvers,
        world: params.world,
      });
    } else if (hasAutonomousControl(autonomousControls, controlState)) {
      writeAutonomousControlInput(
        autonomousControls,
        backgroundControlInput,
        controlState,
      );
      propulsionCommand = applySpacecraftVehicleDynamics({
        controlInput: backgroundControlInput,
        controlPlugins,
        controlState,
        controlledBody,
        dtMillis: params.dtMillis,
        physicsWorkspace,
        propulsionDtMillis: params.dtMillisSim,
        propulsionResolvers,
        updateControlStateFromInput: false,
        world: params.world,
      });
    }

    if (controlledBody.id === params.mainFocus.entityId) {
      focusedPropulsionCommand = propulsionCommand;
      focusedControlState = controlState;
    }
  }

  telemetry.currentThrustLevel =
    focusedPropulsionCommand && focusedControlState
      ? getRenderedThrustLevel(
          focusedPropulsionCommand.main,
          focusedControlState,
        )
      : 0;
  telemetry.currentRcsLevel = focusedPropulsionCommand
    ? getRenderedRcsLevel(focusedPropulsionCommand.rcs)
    : 0;
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
  thrustCommand: ExternalSpacecraftThrustCommand,
  controlState: SpacecraftControlState,
): number {
  if (thrustCommand.forward === 0) {
    return 0;
  }
  return thrustCommand.forward > 0
    ? controlState.thrustLevel
    : -controlState.thrustLevel;
}

function getRenderedRcsLevel(rcsCommand: ExternalSpacecraftRcsCommand): number {
  if (rcsCommand.right === 0) {
    return 0;
  }
  return rcsCommand.right;
}

let manualPropulsionCommand: ExternalSpacecraftPropulsionCommand = {
  main: { forward: 0 },
  rcs: { right: 0 },
};

function getPropulsionCommandForTick(
  dtMillis: number,
  controlInput: ExternalControlInput,
  controlState: SpacecraftControlState,
  controlledBody: ExternalControlledBody,
  world: ExternalWorld,
  controlPlugins: readonly ExternalControlPlugin[],
  propulsionResolvers: readonly ExternalSpacecraftPropulsionResolver[],
  updateControlStateFromInput: boolean,
): ExternalSpacecraftPropulsionCommand {
  if (updateControlStateFromInput) {
    updateControlState(controlInput, controlState, controlPlugins);
  }
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

function hasAutonomousControl(
  autonomousControls: readonly ExternalSpacecraftAutonomousControl[],
  controlState: SpacecraftControlState,
): boolean {
  for (const control of autonomousControls) {
    if (control.hasAutonomousControl(controlState)) return true;
  }
  return false;
}

function writeAutonomousControlInput(
  autonomousControls: readonly ExternalSpacecraftAutonomousControl[],
  controlInput: ExternalControlInput,
  controlState: SpacecraftControlState,
): void {
  for (const control of autonomousControls) {
    control.writeAutonomousControlInput(controlInput, controlState);
  }
}

function applyControlledBodyRotation(
  dtMillis: number,
  controlledBody: ExternalControlledBody,
  workspace: PhysicsWorkspace = defaultPhysicsWorkspace,
): void {
  const dtSec = dtMillis / 1000;
  if (dtSec <= 0) return;

  const omega = controlledBody.angularVelocity;
  if (omega.roll === 0 && omega.pitch === 0 && omega.yaw === 0) return;

  const frame = controlledBody.frame;
  const omegaWorld = workspace.omegaWorld;
  omegaWorld.x =
    frame.forward.x * omega.roll +
    frame.right.x * omega.pitch +
    frame.up.x * omega.yaw;
  omegaWorld.y =
    frame.forward.y * omega.roll +
    frame.right.y * omega.pitch +
    frame.up.y * omega.yaw;
  omegaWorld.z =
    frame.forward.z * omega.roll +
    frame.right.z * omega.pitch +
    frame.up.z * omega.yaw;

  const omegaMagnitude = vec3.length(omegaWorld);
  if (omegaMagnitude === 0) return;
  const orientation = controlledBody.orientation;
  if (orientation === undefined) {
    throw new Error(
      `Controlled body ${controlledBody.id} has no mutable orientation`,
    );
  }

  vec3.scaleInto(workspace.omegaAxis, 1 / omegaMagnitude, omegaWorld);
  localFrame.rotateAroundAxisInPlace(
    frame,
    workspace.omegaAxis,
    omegaMagnitude * dtSec,
  );
  localFrame.intoMat3(orientation, frame);
}

function applyThrust(
  dtMillis: number,
  controlledBody: ExternalControlledBody,
  thrust: ExternalSpacecraftThrustCommand,
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
  controlledBody: ExternalControlledBody,
  rcs: ExternalSpacecraftRcsCommand,
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
