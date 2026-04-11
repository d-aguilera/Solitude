import type { ShipBody, World } from "../domain/domainPorts";
import type { WorldAndSceneConfig } from "./configPorts";
import type {
  AttitudeCommand,
  ControlAction,
  ControlInput,
  ControlledBodyState,
  EnvAction,
  EnvInput,
  SimControlState,
} from "./controlPorts";
import type { PropulsionCommand } from "./controls";
import type { HudRenderParams } from "./hudPorts";
import type { Scene, SceneObject } from "./scenePorts";

export interface KeyHandler {
  handleKeyDown: (
    action: ControlAction | EnvAction,
    isRepeat: boolean,
  ) => boolean;
  handleKeyUp: (action: ControlAction | EnvAction) => boolean;
}

export interface InputPlugin {
  actions?: ControlAction[];
  keyMap?: Record<string, ControlAction | EnvAction>;
  createKeyHandler?: (
    controlInput: ControlInput,
    envInput: EnvInput,
  ) => KeyHandler;
}

export interface ControlStateUpdateParams {
  controlInput: ControlInput;
  controlState: SimControlState;
}

export interface AttitudeCommandParams {
  dtMillis: number;
  ship: ControlledBodyState;
  controlInput: ControlInput;
  controlState: SimControlState;
  world: World;
}

export interface PropulsionCommandParams {
  dtMillis: number;
  ship: ControlledBodyState;
  world: World;
  controlInput: ControlInput;
  manualPropulsion: PropulsionCommand;
  maxThrustAcceleration: number;
  maxRcsTranslationAcceleration: number;
}

export interface ControlPlugin {
  updateControlState?: (params: ControlStateUpdateParams) => void;
  getAttitudeCommand?: (
    params: AttitudeCommandParams,
  ) => AttitudeCommand | null;
  resolvePropulsionCommand?: (
    params: PropulsionCommandParams,
  ) => PropulsionCommand;
}

export interface HudContext {
  nowMs: number;
  world: World;
  mainShip: ShipBody;
  controlInput: ControlInput;
}

export interface HudPlugin {
  updateHudParams?: (params: HudRenderParams, context: HudContext) => void;
}

export interface SceneInitParams {
  scene: Scene;
  world: World;
  mainShip: ShipBody;
  config: WorldAndSceneConfig;
}

export interface SceneUpdateParams {
  dtMillis: number;
  dtSimMillis: number;
  scene: Scene;
  world: World;
  mainShip: ShipBody;
}

export type SceneObjectFilter = (obj: SceneObject) => boolean;

export type SceneViewId = "pilot" | "top";

export interface SceneViewFilterParams {
  viewId: SceneViewId;
  scene: Scene;
  world: World;
  mainShip: ShipBody;
  config: WorldAndSceneConfig;
}

export interface FramePolicy {
  advanceSim: boolean;
  advanceScene: boolean;
  advanceHud: boolean;
}

export interface LoopState {
  timeScale: number;
  framePolicy: FramePolicy;
}

export interface LoopInitParams {
  config: WorldAndSceneConfig;
}

export interface LoopUpdateParams {
  envInput: EnvInput;
  controlInput: ControlInput;
  dtMillis: number;
  nowMs: number;
  state: LoopState;
}

export interface ScenePlugin {
  initScene?: (params: SceneInitParams) => void;
  updateScene?: (params: SceneUpdateParams) => void;
  getViewObjectsFilter?: (
    params: SceneViewFilterParams,
  ) => SceneObjectFilter | null;
}

export interface LoopPlugin {
  initLoop?: (params: LoopInitParams) => void;
  updateLoopState?: (params: LoopUpdateParams) => Partial<LoopState> | null;
}

export interface GamePlugin {
  id: string;
  controls?: ControlPlugin;
  hud?: HudPlugin;
  input?: InputPlugin;
  loop?: LoopPlugin;
  scene?: ScenePlugin;
}
