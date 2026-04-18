import type { ShipBody, World } from "../domain/domainPorts";
import type { Vec3 } from "../domain/vec3";
import type { WorldAndSceneConfig } from "./configPorts";
import type {
  AttitudeCommand,
  ControlAction,
  ControlInput,
  ControlledBodyState,
  SimControlState,
} from "./controlPorts";
import type { PropulsionCommand } from "./controls";
import type { HudGrid } from "./hudPorts";
import type { Scene, SceneObject } from "./scenePorts";

export interface KeyHandler {
  handleKeyDown: (action: ControlAction, isRepeat: boolean) => boolean;
  handleKeyUp: (action: ControlAction) => boolean;
}

export interface InputPlugin {
  actions?: ControlAction[];
  keyMap?: Record<string, ControlAction>;
  createKeyHandler?: (controlInput: ControlInput) => KeyHandler;
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
  currentThrustLevel: number;
  currentRcsLevel: number;
  fps: number;
  simTimeMillis: number;
}

export interface HudPlugin {
  updateHudParams: (grid: HudGrid, context: HudContext) => void;
}

export interface WorldSegment {
  start: Vec3;
  end: Vec3;
  cssColor: string;
  lineWidth: number;
}

export interface SegmentProviderParams {
  viewId: SceneViewId;
  scene: Scene;
  world: World;
  mainShip: ShipBody;
  config: WorldAndSceneConfig;
}

export interface SegmentPlugin {
  appendSegments?: (
    into: WorldSegment[],
    params: SegmentProviderParams,
  ) => void;
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

export type SceneViewId = "pilot" | "top" | "left" | "right" | "rear";

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
  simDtMillis?: number;
}

export interface LoopState {
  framePolicy: FramePolicy;
}

export interface LoopInitParams {
  config: WorldAndSceneConfig;
}

export interface LoopUpdateParams {
  controlInput: ControlInput;
  dtMillis: number;
  nowMs: number;
  state: LoopState;
}

export interface LoopUpdateResult {
  framePolicy?: Partial<FramePolicy>;
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
  updateLoopState?: (params: LoopUpdateParams) => LoopUpdateResult | null;
  afterFrame?: (params: LoopUpdateParams) => void;
}

export interface GamePlugin {
  id: string;
  controls?: ControlPlugin;
  hud?: HudPlugin;
  input?: InputPlugin;
  loop?: LoopPlugin;
  segments?: SegmentPlugin;
  scene?: ScenePlugin;
}
