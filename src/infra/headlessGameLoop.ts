import { createControlInput, type ControlInput } from "../app/controlPorts";
import { createTickHandler } from "../app/game";
import { createPluginCapabilityRegistry } from "../app/pluginCapabilities";
import type {
  ControlPlugin,
  GamePlugin,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
  SimulationPlugin,
} from "../app/pluginPorts";
import { validatePluginRequirements } from "../app/pluginRequirements";
import type { TickParams, WorldAndScene } from "../app/runtimePorts";
import type { Scene } from "../app/scenePorts";
import type { GravityEngine } from "../domain/domainPorts";
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
  worldAndScene: WorldAndScene;
  step: (dtMillis: number, controlInput?: Partial<ControlInput>) => void;
}

const EMPTY_SCENE: Scene = { objects: [], lights: [] };

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
  const controlPlugins = [
    ...collectControlPlugins(plugins),
    ...(options.controlPlugins ?? []),
  ];
  const capabilityRegistry = createPluginCapabilityRegistry(
    collectCapabilityProviders(plugins, options.capabilityProviders),
  );
  validatePluginRequirements({
    mainFocus: worldSetup.mainFocus,
    plugins,
    world: worldSetup.world,
  });
  const simulationPlugins = [
    ...collectSimulationPlugins(plugins, controlPlugins, capabilityRegistry),
    ...(options.simulationPlugins ?? []),
  ];

  const tick = createTickHandler(
    gravityEngine,
    worldAndScene,
    simulationPlugins,
  );

  const baseControlInput = createControlInput();

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput: baseControlInput,
  };

  const step = (
    dtMillis: number,
    controlInput?: Partial<ControlInput>,
  ): void => {
    tickParams.dtMillis = dtMillis;
    tickParams.dtMillisSim = dtMillis * timeScale;
    tickParams.controlInput = mergeControlInput(baseControlInput, controlInput);

    tick(tickParams);
  };

  return { worldAndScene, step };
}

function collectControlPlugins(
  plugins: readonly GamePlugin[],
): ControlPlugin[] {
  const controlPlugins: ControlPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.controls) {
      controlPlugins.push(plugin.controls);
    }
  }
  return controlPlugins;
}

function collectCapabilityProviders(
  plugins: readonly GamePlugin[],
  additionalProviders: readonly PluginCapabilityProvider[] | undefined,
): PluginCapabilityProvider[] {
  const providers: PluginCapabilityProvider[] = [];
  for (const plugin of plugins) {
    if (plugin.capabilities) {
      providers.push(...plugin.capabilities);
    }
  }
  if (additionalProviders) {
    providers.push(...additionalProviders);
  }
  return providers;
}

function collectSimulationPlugins(
  plugins: readonly GamePlugin[],
  controlPlugins: ControlPlugin[],
  capabilityRegistry: PluginCapabilityRegistry,
): SimulationPlugin[] {
  const simulationPlugins: SimulationPlugin[] = [];
  for (const plugin of plugins) {
    if (!plugin.simulation) continue;
    simulationPlugins.push(
      typeof plugin.simulation === "function"
        ? plugin.simulation({ capabilityRegistry, controlPlugins })
        : plugin.simulation,
    );
  }
  return simulationPlugins;
}
