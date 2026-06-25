import { resolveCollisions } from "../domain/collisions";
import type { GravityEngine } from "../domain/domainPorts";
import {
  buildInitialGravityState,
  refreshGravityState,
} from "../domain/gravityState";
import type { ControlInput } from "./controlPorts";
import {
  applyAxialSpin,
  applyGravity,
  createPhysicsWorkspace,
} from "./physics";
import type { SimulationPhaseParams, SimulationPlugin } from "./pluginPorts";
import type { TickCallback, TickParams, WorldAndScene } from "./runtimePorts";

const EMPTY_ENTITY_CONTROL_INPUTS = new Map();

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gravityEngine: GravityEngine,
  worldAndScene: WorldAndScene,
  tickParams: Readonly<TickParams>,
  simulationPlugins: SimulationPlugin[] = [],
): TickCallback {
  const simPhasePlan = createSimulationPhasePlan(simulationPlugins);
  const physicsWorkspace = createPhysicsWorkspace();
  const gravityState = buildInitialGravityState(worldAndScene.world);
  const simPhaseParams: SimulationPhaseParams = {
    controlInput: {} as ControlInput,
    controlInputsByEntityId: EMPTY_ENTITY_CONTROL_INPUTS,
    dtMillis: 0,
    dtMillisSim: 0,
    mainFocus: worldAndScene.mainFocus,
    world: worldAndScene.world,
  };

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  const tick: TickCallback = () => {
    simPhaseParams.controlInput = tickParams.controlInput;
    simPhaseParams.controlInputsByEntityId = tickParams.controlInputsByEntityId;
    simPhaseParams.dtMillis = tickParams.dtMillis;
    simPhaseParams.dtMillisSim = tickParams.dtMillisSim;

    applySimulationPhase(simPhasePlan.beforeVehicleDynamics, simPhaseParams);
    applySimulationPhase(simPhasePlan.updateVehicleDynamics, simPhaseParams);
    applySimulationPhase(simPhasePlan.afterVehicleDynamics, simPhaseParams);

    applySimulationPhase(simPhasePlan.beforeGravity, simPhaseParams);
    applyGravity(tickParams.dtMillisSim, gravityEngine, gravityState);
    applySimulationPhase(simPhasePlan.afterGravity, simPhaseParams);

    resolveCollisions(worldAndScene.world);
    applySimulationPhase(simPhasePlan.afterCollisions, simPhaseParams);

    applyAxialSpin(
      tickParams.dtMillisSim,
      worldAndScene.world,
      physicsWorkspace,
    );
    applySimulationPhase(simPhasePlan.afterSpin, simPhaseParams);
  };

  tick.refreshGravityState = () => {
    refreshGravityState(worldAndScene.world, gravityState);
  };

  return tick;
}

type SimulationPhaseHook = (params: SimulationPhaseParams) => void;

interface SimulationPhasePlan {
  beforeVehicleDynamics: SimulationPhaseHook[];
  updateVehicleDynamics: SimulationPhaseHook[];
  afterVehicleDynamics: SimulationPhaseHook[];
  beforeGravity: SimulationPhaseHook[];
  afterGravity: SimulationPhaseHook[];
  afterCollisions: SimulationPhaseHook[];
  afterSpin: SimulationPhaseHook[];
}

function createSimulationPhasePlan(
  plugins: readonly SimulationPlugin[],
): SimulationPhasePlan {
  const plan: SimulationPhasePlan = {
    beforeVehicleDynamics: [],
    updateVehicleDynamics: [],
    afterVehicleDynamics: [],
    beforeGravity: [],
    afterGravity: [],
    afterCollisions: [],
    afterSpin: [],
  };

  for (const plugin of plugins) {
    if (plugin.beforeVehicleDynamics) {
      plan.beforeVehicleDynamics.push(
        plugin.beforeVehicleDynamics.bind(plugin),
      );
    }
    if (plugin.updateVehicleDynamics) {
      plan.updateVehicleDynamics.push(
        plugin.updateVehicleDynamics.bind(plugin),
      );
    }
    if (plugin.afterVehicleDynamics) {
      plan.afterVehicleDynamics.push(plugin.afterVehicleDynamics.bind(plugin));
    }
    if (plugin.beforeGravity) {
      plan.beforeGravity.push(plugin.beforeGravity.bind(plugin));
    }
    if (plugin.afterGravity) {
      plan.afterGravity.push(plugin.afterGravity.bind(plugin));
    }
    if (plugin.afterCollisions) {
      plan.afterCollisions.push(plugin.afterCollisions.bind(plugin));
    }
    if (plugin.afterSpin) {
      plan.afterSpin.push(plugin.afterSpin.bind(plugin));
    }
  }

  return plan;
}

function applySimulationPhase(
  hooks: readonly SimulationPhaseHook[],
  params: SimulationPhaseParams,
): void {
  for (let i = 0; i < hooks.length; i++) hooks[i](params);
}
