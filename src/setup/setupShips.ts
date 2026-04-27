import type {
  ShipInitialStateConfig,
  ShipPhysicsConfig,
} from "../app/configPorts";
import type {
  AngularVelocity,
  ControlledBody,
  ShipPhysics,
} from "../domain/domainPorts";
import { localFrame, type LocalFrame } from "../domain/localFrame";
import { mat3, type Mat3 } from "../domain/mat3";
import { vec3, type Vec3 } from "../domain/vec3";

export interface ShipsSetup {
  shipPhysics: ShipPhysics[];
  ships: ControlledBody[];
}

export function createShipsFromConfig(
  configs: ShipPhysicsConfig[],
  initialStates: ShipInitialStateConfig[],
): ShipsSetup {
  const initialStateById = buildInitialStateMap(initialStates);
  const setup: ShipsSetup = {
    shipPhysics: [],
    ships: [],
  };

  for (const config of configs) {
    validateShipPhysicsConfig(config);
    const initialState = initialStateById.get(config.id);
    if (!initialState) {
      throw new Error(`Ship initial state not found: ${config.id}`);
    }

    const { shipBody, shipPhysics } = createShip(config, initialState);
    setup.ships.push(shipBody);
    setup.shipPhysics.push(shipPhysics);
  }

  return setup;
}

function createShip(
  { id, density, volume }: ShipPhysicsConfig,
  initialState: ShipInitialStateConfig,
): { shipBody: ControlledBody; shipPhysics: ShipPhysics } {
  validateShipInitialState(initialState);

  const shipPhysics: ShipPhysics = {
    id,
    density,
    mass: density * volume,
  };

  const shipBody: ControlledBody = {
    id,
    angularVelocity: cloneAngularVelocity(initialState.angularVelocity),
    frame: cloneFrame(initialState.frame),
    orientation: cloneMat3(initialState.orientation),
    position: vec3.clone(initialState.position),
    velocity: vec3.clone(initialState.velocity),
  };

  return { shipBody, shipPhysics };
}

function buildInitialStateMap(
  initialStates: ShipInitialStateConfig[],
): Map<string, ShipInitialStateConfig> {
  const byId = new Map<string, ShipInitialStateConfig>();
  for (const state of initialStates) {
    if (!state?.id) {
      throw new Error("Ship initial state is missing id");
    }
    byId.set(state.id, state);
  }
  return byId;
}

function validateShipPhysicsConfig(config: ShipPhysicsConfig): void {
  if (!config.id) {
    throw new Error("Ship physics config is missing id");
  }
  if (!(config.density > 0)) {
    throw new Error(`Ship physics config has invalid density: ${config.id}`);
  }
  if (!(config.volume > 0)) {
    throw new Error(`Ship physics config has invalid volume: ${config.id}`);
  }
}

function validateShipInitialState(state: ShipInitialStateConfig): void {
  if (!state.id) throw new Error("Ship initial state is missing id");
  if (!isVec3(state.position)) {
    throw new Error(`Ship initial state is missing position: ${state.id}`);
  }
  if (!isVec3(state.velocity)) {
    throw new Error(`Ship initial state is missing velocity: ${state.id}`);
  }
  if (!isFrame(state.frame)) {
    throw new Error(`Ship initial state is missing frame: ${state.id}`);
  }
  if (!isMat3(state.orientation)) {
    throw new Error(`Ship initial state is missing orientation: ${state.id}`);
  }
  if (!isAngularVelocity(state.angularVelocity)) {
    throw new Error(
      `Ship initial state is missing angularVelocity: ${state.id}`,
    );
  }
}

function isVec3(value: Vec3 | undefined): value is Vec3 {
  return (
    !!value &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

function isFrame(value: LocalFrame | undefined): value is LocalFrame {
  return (
    !!value && isVec3(value.right) && isVec3(value.forward) && isVec3(value.up)
  );
}

function isMat3(value: Mat3 | undefined): value is Mat3 {
  return (
    !!value &&
    value.length === 3 &&
    value[0].length === 3 &&
    value[1].length === 3 &&
    value[2].length === 3
  );
}

function isAngularVelocity(
  value: AngularVelocity | undefined,
): value is AngularVelocity {
  return (
    !!value &&
    Number.isFinite(value.roll) &&
    Number.isFinite(value.pitch) &&
    Number.isFinite(value.yaw)
  );
}

function cloneFrame(frame: LocalFrame): LocalFrame {
  return localFrame.clone(frame);
}

function cloneMat3(orientation: Mat3): Mat3 {
  return mat3.copy(orientation, mat3.zero());
}

function cloneAngularVelocity(
  angularVelocity: AngularVelocity,
): AngularVelocity {
  return {
    pitch: angularVelocity.pitch,
    roll: angularVelocity.roll,
    yaw: angularVelocity.yaw,
  };
}
