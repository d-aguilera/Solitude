import { createControlInput, type ControlInput } from "../app/controlPorts";
import { createTickHandler } from "../app/game";
import { resolveGravityEngine } from "../app/gravityProvider";
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
import type { EntityId } from "../domain/domainPorts";
import { createHeadlessWorld, type WorldConfigBase } from "../setup/setup";

export interface HeadlessLoopOptions {
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

function mergeControlInputInto(
  merged: ControlInput,
  base: ControlInput,
  overrides?: Partial<ControlInput>,
): ControlInput {
  for (const key in merged) merged[key] = false;
  for (const key in base) merged[key] = base[key];
  if (!overrides) return merged;
  for (const key in overrides) {
    const value = overrides[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

function mergeEntityControlInputsInto(
  mergedByEntityId: Map<EntityId, ControlInput>,
  base: ControlInput,
  overridesByEntityId: ReadonlyMap<EntityId, Partial<ControlInput>>,
): ReadonlyMap<EntityId, ControlInput> {
  for (const entityId of mergedByEntityId.keys()) {
    if (!overridesByEntityId.has(entityId)) mergedByEntityId.delete(entityId);
  }
  for (const [entityId, overrides] of overridesByEntityId) {
    let merged = mergedByEntityId.get(entityId);
    if (!merged) {
      merged = createControlInput();
      mergedByEntityId.set(entityId, merged);
    }
    mergeControlInputInto(merged, base, overrides);
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
  const mergedControlInput = createControlInput();
  const mergedEntityControlInputs = new Map<EntityId, ControlInput>();

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput: baseControlInput,
    controlInputsByEntityId: EMPTY_ENTITY_CONTROL_INPUTS,
  };

  const tick = createTickHandler(
    resolveGravityEngine(plugins),
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
    tickParams.controlInput = controlInput
      ? mergeControlInputInto(
          mergedControlInput,
          baseControlInput,
          controlInput,
        )
      : baseControlInput;
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
    tickParams.controlInputsByEntityId = mergeEntityControlInputsInto(
      mergedEntityControlInputs,
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
