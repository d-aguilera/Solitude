import type { ControlledBody, World } from "../domain/domainPorts";
import type { Vec3 } from "../domain/vec3";
import type { WorldAndSceneConfig } from "./configPorts";
import type {
  AttitudeCommand,
  ControlAction,
  ControlInput,
  ControlledBodyState,
  PropulsionCommand,
  SimControlState,
} from "./controlPorts";
import type { EntityConfig, EntityId } from "./entityConfigPorts";
import type { HudGrid } from "./hudPorts";
import type { FocusContext } from "./runtimePorts";
import type { Scene, SceneObject } from "./scenePorts";
import type { SceneViewId, ViewDefinition } from "./viewPorts";

export type RuntimeOptions = Readonly<Record<string, string>>;

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

export interface SimulationPhaseParams {
  controlInput: ControlInput;
  controlState: SimControlState;
  dtMillis: number;
  dtMillisSim: number;
  mainFocus: FocusContext;
  mainControlledBody: ControlledBody;
  world: World;
}

export interface SimulationPlugin {
  beforeVehicleDynamics?: (params: SimulationPhaseParams) => void;
  afterVehicleDynamics?: (params: SimulationPhaseParams) => void;
  beforeGravity?: (params: SimulationPhaseParams) => void;
  afterGravity?: (params: SimulationPhaseParams) => void;
  afterCollisions?: (params: SimulationPhaseParams) => void;
  afterSpin?: (params: SimulationPhaseParams) => void;
}

export interface HudContext {
  nowMs: number;
  world: World;
  mainFocus: FocusContext;
  mainControlledBody: ControlledBody;
  controlInput: ControlInput;
  currentThrustLevel: number;
  currentRcsLevel: number;
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
  mainFocus: FocusContext;
  mainControlledBody: ControlledBody;
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
  mainFocus: FocusContext;
  mainControlledBody: ControlledBody;
  config: WorldAndSceneConfig;
}

export interface SceneUpdateParams {
  dtMillis: number;
  dtSimMillis: number;
  scene: Scene;
  world: World;
  mainFocus: FocusContext;
  mainControlledBody: ControlledBody;
}

export type SceneObjectFilter = (obj: SceneObject) => boolean;

export interface SceneViewFilterParams {
  viewId: SceneViewId;
  scene: Scene;
  world: World;
  mainFocus: FocusContext;
  mainControlledBody: ControlledBody;
  config: WorldAndSceneConfig;
}

export interface FramePolicy {
  advanceSim: boolean;
  advanceScene: boolean;
  advanceHud: boolean;
  tickDtMillis?: number;
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
  mainFocus?: FocusContext;
  mainControlledBody?: ControlledBody;
  nowMs: number;
  simTimeMillis?: number;
  state: LoopState;
  world?: World;
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
  getInitialSimTimeMillis?: () => number | null;
  updateLoopState?: (params: LoopUpdateParams) => LoopUpdateResult | null;
  afterFrame?: (params: LoopUpdateParams) => void;
}

export interface ViewRegistry {
  addView: (view: ViewDefinition) => void;
}

export interface ViewRegistrationParams {
  config: WorldAndSceneConfig;
}

export interface ViewPlugin {
  registerViews: (
    registry: ViewRegistry,
    params: ViewRegistrationParams,
  ) => void;
}

export interface WorldModelRegistry {
  addEntities: (entities: EntityConfig[]) => void;
  setMainControlledEntityId: (id: EntityId) => void;
}

export interface WorldModelContributionParams {
  config: WorldAndSceneConfig;
}

export interface WorldModelPlugin {
  contributeWorldModel: (
    registry: WorldModelRegistry,
    params: WorldModelContributionParams,
  ) => void;
}

export interface GamePlugin {
  id: string;
  controls?: ControlPlugin;
  hud?: HudPlugin;
  input?: InputPlugin;
  loop?: LoopPlugin;
  segments?: SegmentPlugin;
  scene?: ScenePlugin;
  simulation?: SimulationPlugin;
  views?: ViewPlugin;
  worldModel?: WorldModelPlugin;
}
