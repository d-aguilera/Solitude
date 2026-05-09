import { resolveCollisions } from "../domain/collisions";
import type { GravityEngine } from "../domain/domainPorts";
import { buildInitialGravityState } from "../domain/gravityState";
import type { ControlInput } from "./controlPorts";
import {
  applyAxialSpin,
  applyGravity,
  createPhysicsWorkspace,
} from "./physics";
import type { SimulationPlugin } from "./pluginPorts";
import type { TickCallback, TickParams, WorldAndScene } from "./runtimePorts";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gravityEngine: GravityEngine,
  worldAndScene: WorldAndScene,
  simulationPlugins: SimulationPlugin[] = [],
): TickCallback {
  const simulationPhasePlan = createSimulationPhasePlan(simulationPlugins);
  const physicsWorkspace = createPhysicsWorkspace();
  const gravityState = buildInitialGravityState(worldAndScene.world);
  const simulationPhaseParams = {
    controlInput: {} as ControlInput,
    dtMillis: 0,
    dtMillisSim: 0,
    mainFocus: worldAndScene.mainFocus,
    world: worldAndScene.world,
  };

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (params: TickParams): void => {
    simulationPhaseParams.controlInput = params.controlInput;
    simulationPhaseParams.dtMillis = params.dtMillis;
    simulationPhaseParams.dtMillisSim = params.dtMillisSim;

    applySimulationPhase(
      simulationPhasePlan.beforeVehicleDynamics,
      simulationPhaseParams,
    );
    applySimulationPhase(
      simulationPhasePlan.updateVehicleDynamics,
      simulationPhaseParams,
    );
    applySimulationPhase(
      simulationPhasePlan.afterVehicleDynamics,
      simulationPhaseParams,
    );

    applySimulationPhase(
      simulationPhasePlan.beforeGravity,
      simulationPhaseParams,
    );
    applyGravity(params.dtMillisSim, gravityEngine, gravityState);
    applySimulationPhase(
      simulationPhasePlan.afterGravity,
      simulationPhaseParams,
    );

    resolveCollisions(worldAndScene.world);
    applySimulationPhase(
      simulationPhasePlan.afterCollisions,
      simulationPhaseParams,
    );

    applyAxialSpin(params.dtMillisSim, worldAndScene.world, physicsWorkspace);
    applySimulationPhase(simulationPhasePlan.afterSpin, simulationPhaseParams);
  };
}

type SimulationPhaseParams = Parameters<
  NonNullable<SimulationPlugin["beforeVehicleDynamics"]>
>[0];

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
