import { createControlInput, type ControlInput } from "../app/controlPorts";
import { createTickHandler } from "../app/game";
import { createPluginCapabilityRegistry } from "../app/pluginCapabilities";
import type {
  ControlPlugin,
  GamePlugin,
  PluginCapabilityProvider,
  SimulationPlugin,
} from "../app/pluginPorts";
import { validatePluginRequirements } from "../app/pluginRequirements";
import { assembleSimulationPlugins } from "../app/pluginRuntime";
import type { TickParams, WorldAndScene } from "../app/runtimePorts";
import type { Scene } from "../app/scenePorts";
import type { EntityId, GravityEngine } from "../domain/domainPorts";
import { parameters } from "../global/parameters";
import { createHeadlessWorld, type WorldConfigBase } from "../setup/setup";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine";

export interface HeadlessLoopOptions {
  gravityEngine?: GravityEngine;
  timeScale?: number;
  plugins?: GamePlugin[];
  capabilityProviders?: PluginCapabilityProvider[];
  controlPlugins?: ControlPlugin[];
  simulationPlugins?: SimulationPlugin[];
}

export interface HeadlessLoop {
  refreshGravityState: () => void;
  worldAndScene: WorldAndScene;
  step: (dtMillis: number, controlInput?: Partial<ControlInput>) => void;
  stepWithEntityInputs: (
    dtMillis: number,
    controlInputsByEntityId: ReadonlyMap<EntityId, Partial<ControlInput>>,
  ) => void;
  stepWithEntityInputsAndSimDt: (
    dtMillis: number,
    dtMillisSim: number,
    controlInputsByEntityId: ReadonlyMap<EntityId, Partial<ControlInput>>,
  ) => void;
}

const EMPTY_SCENE: Scene = { objects: [], lights: [] };
const EMPTY_ENTITY_CONTROL_INPUTS = new Map();

function mergeControlInput(
  base: ControlInput,
  overrides?: Partial<ControlInput>,
): ControlInput {
  if (!overrides) return base;
  const merged: Record<string, boolean> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as ControlInput;
}

function mergeEntityControlInputs(
  base: ControlInput,
  overridesByEntityId: ReadonlyMap<EntityId, Partial<ControlInput>>,
): ReadonlyMap<EntityId, ControlInput> {
  const mergedByEntityId = new Map<EntityId, ControlInput>();
  for (const [entityId, overrides] of overridesByEntityId) {
    mergedByEntityId.set(entityId, mergeControlInput(base, overrides));
  }
  return mergedByEntityId;
}

/**
 * Headless simulation loop that advances the world without any rendering
 * or DOM dependencies. Intended for tests.
 */
export function createHeadlessLoop(
  config: WorldConfigBase,
  options: HeadlessLoopOptions = {},
): HeadlessLoop {
  const worldSetup = createHeadlessWorld(config);

  const worldAndScene: WorldAndScene = {
    ...worldSetup,
    scene: EMPTY_SCENE,
  };

  const gravityEngine: GravityEngine =
    options.gravityEngine ??
    new NewtonianGravityEngine(parameters.newtonG, parameters.softeningLength);

  const timeScale = options.timeScale ?? 1;
  const plugins = options.plugins ?? [];
  const simulationAssembly = assembleSimulationPlugins(
    plugins,
    options.capabilityProviders ?? [],
    options.controlPlugins ?? [],
    options.simulationPlugins ?? [],
  );
  const capabilityRegistry = createPluginCapabilityRegistry(
    simulationAssembly.capabilityProviders,
  );
  validatePluginRequirements({
    mainFocus: worldSetup.mainFocus,
    plugins,
    world: worldSetup.world,
  });
  const simulationPlugins =
    simulationAssembly.createSimulationPlugins(capabilityRegistry);

  const baseControlInput = createControlInput();

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput: baseControlInput,
    controlInputsByEntityId: EMPTY_ENTITY_CONTROL_INPUTS,
  };

  const tick = createTickHandler(
    gravityEngine,
    worldAndScene,
    tickParams,
    simulationPlugins,
  );

  const step = (
    dtMillis: number,
    controlInput?: Partial<ControlInput>,
  ): void => {
    tickParams.dtMillis = dtMillis;
    tickParams.dtMillisSim = dtMillis * timeScale;
    tickParams.controlInput = mergeControlInput(baseControlInput, controlInput);
    tickParams.controlInputsByEntityId = EMPTY_ENTITY_CONTROL_INPUTS;

    tick();
  };

  const stepWithEntityInputs = (
    dtMillis: number,
    controlInputsByEntityId: ReadonlyMap<EntityId, Partial<ControlInput>>,
  ): void => {
    stepWithEntityInputsAndSimDt(
      dtMillis,
      dtMillis * timeScale,
      controlInputsByEntityId,
    );
  };

  const stepWithEntityInputsAndSimDt = (
    dtMillis: number,
    dtMillisSim: number,
    controlInputsByEntityId: ReadonlyMap<EntityId, Partial<ControlInput>>,
  ): void => {
    tickParams.dtMillis = dtMillis;
    tickParams.dtMillisSim = dtMillisSim;
    tickParams.controlInput = baseControlInput;
    tickParams.controlInputsByEntityId = mergeEntityControlInputs(
      baseControlInput,
      controlInputsByEntityId,
    );

    tick();
  };

  return {
    refreshGravityState: tick.refreshGravityState,
    worldAndScene,
    step,
    stepWithEntityInputs,
    stepWithEntityInputsAndSimDt,
  };
}
