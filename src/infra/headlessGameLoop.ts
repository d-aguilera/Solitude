import { ALL_CONTROL_ACTIONS, type ControlInput } from "../app/controlPorts.js";
import { createTickHandler } from "../app/game.js";
import type {
  TickOutput,
  TickParams,
  WorldAndScene,
} from "../app/runtimePorts.js";
import type { Scene } from "../app/scenePorts.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { parameters } from "../global/parameters.js";
import { createHeadlessWorld, type WorldConfigBase } from "../setup/setup.js";
import { NewtonianGravityEngine } from "./NewtonianGravityEngine.js";

export interface HeadlessLoopOptions {
  gravityEngine?: GravityEngine;
  thrustLevel?: number;
  timeScale?: number;
}

export interface HeadlessLoop {
  worldAndScene: WorldAndScene;
  step: (dtMillis: number, controlInput?: Partial<ControlInput>) => TickOutput;
}

const EMPTY_SCENE: Scene = { objects: [], lights: [] };

const EMPTY_CONTROL_INPUT: ControlInput = ALL_CONTROL_ACTIONS.reduce(
  (acc, action) => {
    acc[action] = false;
    return acc;
  },
  {} as ControlInput,
);

function mergeControlInput(overrides?: Partial<ControlInput>): ControlInput {
  if (!overrides) return EMPTY_CONTROL_INPUT;
  return { ...EMPTY_CONTROL_INPUT, ...overrides };
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
    trajectoryList: [],
  };

  const gravityEngine: GravityEngine =
    options.gravityEngine ??
    new NewtonianGravityEngine(parameters.newtonG, parameters.softeningLength);

  const thrustLevel = options.thrustLevel ?? 1;
  const timeScale = options.timeScale ?? 1;

  const tickInto = createTickHandler(gravityEngine, thrustLevel, worldAndScene);

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput: EMPTY_CONTROL_INPUT,
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
    tickParams.controlInput = mergeControlInput(controlInput);

    tickInto(tickOutput, tickParams);

    return { ...tickOutput };
  };

  return { worldAndScene, step };
}
