import { createControlInput, type ControlInput } from "../app/controlPorts";
import { createTickHandler } from "../app/game";
import type { ControlPlugin } from "../app/pluginPorts";
import type {
  TickOutput,
  TickParams,
  WorldAndScene,
} from "../app/runtimePorts";
import type { Scene } from "../app/scenePorts";
import type { GravityEngine } from "../domain/domainPorts";
import { parameters } from "../global/parameters";
import { createHeadlessWorld, type WorldConfigBase } from "../setup/setup";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine";

export interface HeadlessLoopOptions {
  gravityEngine?: GravityEngine;
  thrustLevel?: number;
  timeScale?: number;
  controlPlugins?: ControlPlugin[];
}

export interface HeadlessLoop {
  worldAndScene: WorldAndScene;
  step: (dtMillis: number, controlInput?: Partial<ControlInput>) => TickOutput;
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

  const thrustLevel = options.thrustLevel ?? 1;
  const timeScale = options.timeScale ?? 1;

  const tickInto = createTickHandler(
    gravityEngine,
    thrustLevel,
    worldAndScene,
    options.controlPlugins ?? [],
  );

  const baseControlInput = createControlInput();

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput: baseControlInput,
  };

  const tickOutput: TickOutput = {
    currentThrustLevel: 0,
    currentRcsLevel: 0,
  };

  const step = (
    dtMillis: number,
    controlInput?: Partial<ControlInput>,
  ): TickOutput => {
    tickParams.dtMillis = dtMillis;
    tickParams.dtMillisSim = dtMillis * timeScale;
    tickParams.controlInput = mergeControlInput(baseControlInput, controlInput);

    tickInto(tickOutput, tickParams);

    return { ...tickOutput };
  };

  return { worldAndScene, step };
}
