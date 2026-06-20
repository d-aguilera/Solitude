import type { EntityId, World } from "../domain/domainPorts";
import type { Vec3 } from "../domain/vec3";
import type { WorldAndSceneConfig } from "./configPorts";
import type {
  AttitudeCommand,
  ControlInput,
  ControlledBodyState,
  EntityControlInputs,
  MutableControlState,
} from "./controlPorts";
import type { EntityConfig } from "./entityConfigPorts";
import type { FocusContext } from "./runtimePorts";
import type { RGB, Scene, SceneControlState, SceneObject } from "./scenePorts";
import type {
  MainViewCameraRig,
  SceneState,
  SceneViewId,
  ViewDefinition,
  ViewLabelMode,
} from "./viewPorts";

export type RuntimeOptions = Readonly<Record<string, string>>;

export interface ControlStateUpdateParams {
  controlInput: ControlInput;
  controlState: MutableControlState;
}

export interface AttitudeCommandParams {
  dtMillis: number;
  controlledBody: ControlledBodyState;
  controlInput: ControlInput;
  controlState: MutableControlState;
  world: World;
}

export interface PluginCapabilityProvider {
  id: string;
  value: unknown;
}

export interface PluginCapabilityRegistry {
  getAll: (id: string) => readonly unknown[];
}

export interface ControlPlugin {
  updateControlState?: (params: ControlStateUpdateParams) => void;
  getAttitudeCommand?: (
    params: AttitudeCommandParams,
  ) => AttitudeCommand | null;
}

export interface SimulationPhaseParams {
  controlInput: ControlInput;
  controlInputsByEntityId: EntityControlInputs;
  dtMillis: number;
  dtMillisSim: number;
  mainFocus: FocusContext;
  world: World;
}

export interface SimulationPlugin {
  beforeVehicleDynamics?: (params: SimulationPhaseParams) => void;
  updateVehicleDynamics?: (params: SimulationPhaseParams) => void;
  afterVehicleDynamics?: (params: SimulationPhaseParams) => void;
  beforeGravity?: (params: SimulationPhaseParams) => void;
  afterGravity?: (params: SimulationPhaseParams) => void;
  afterCollisions?: (params: SimulationPhaseParams) => void;
  afterSpin?: (params: SimulationPhaseParams) => void;
}

export interface SimulationContributionParams {
  capabilityRegistry: PluginCapabilityRegistry;
  controlPlugins: ControlPlugin[];
}

export type SimulationContribution =
  | SimulationPlugin
  | ((params: SimulationContributionParams) => SimulationPlugin);

export interface WorldSegment {
  start: Vec3;
  end: Vec3;
  color: RGB;
  lineWidth: number;
}

export interface SegmentProviderParams {
  viewId: SceneViewId;
  scene: Scene;
  world: World;
  mainFocus: FocusContext;
  config: WorldAndSceneConfig;
}

export interface SegmentPlugin {
  appendSegments?: (
    into: WorldSegment[],
    params: SegmentProviderParams,
  ) => void;
}

export interface SceneLabelCandidate {
  id: string;
  anchor: Vec3;
  lines: readonly string[];
  parentId?: EntityId;
  priority?: number;
}

export interface SceneLabelProviderParams {
  viewId: SceneViewId;
  labelMode: ViewLabelMode;
  scene: Scene;
  world: World;
  mainFocus: FocusContext;
  config: WorldAndSceneConfig;
  capabilityRegistry: PluginCapabilityRegistry;
}

export interface SceneLabelPlugin {
  appendLabels?: (
    into: SceneLabelCandidate[],
    params: SceneLabelProviderParams,
  ) => void;
}

export interface SceneInitParams {
  scene: Scene;
  world: World;
  mainFocus: FocusContext;
  config: WorldAndSceneConfig;
}

export interface SceneUpdateParams {
  dtMillis: number;
  dtSimMillis: number;
  scene: Scene;
  world: World;
  mainFocus: FocusContext;
}

export interface ViewControlUpdateParams {
  controlInput: ControlInput;
  dtMillis: number;
  mainFocus: FocusContext;
  sceneControlState: SceneControlState;
  sceneState: SceneState;
}

export type SceneObjectFilter = (obj: SceneObject) => boolean;

export interface SceneViewFilterParams {
  viewId: SceneViewId;
  scene: Scene;
  world: World;
  mainFocus: FocusContext;
  config: WorldAndSceneConfig;
}

export interface FramePolicy {
  advanceSim: boolean;
  advanceScene: boolean;
  advancePresentation: boolean;
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
  mainFocus: FocusContext;
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

export interface ViewControlPlugin {
  updateViewControls?: (params: ViewControlUpdateParams) => void;
}

export interface LoopPlugin {
  initLoop?: (params: LoopInitParams) => void;
  getInitialSimTimeMillis?: () => number | null;
  updateLoopState?: (params: LoopUpdateParams) => LoopUpdateResult | null;
  afterFrame?: (params: LoopUpdateParams) => void;
}

export interface ViewRegistry {
  addMainViewCameraRig: (rig: MainViewCameraRig) => void;
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
  setMainFocusEntityId: (id: EntityId) => void;
}

export interface WorldModelContributionParams {
  capabilityRegistry: PluginCapabilityRegistry;
  config: WorldAndSceneConfig;
}

export interface WorldModelPlugin {
  contributeWorldModel: (
    registry: WorldModelRegistry,
    params: WorldModelContributionParams,
  ) => void;
}

export type FocusCapabilityRequirement =
  | "angularVelocity"
  | "collisionSphere"
  | "controlledBody"
  | "gravityMass"
  | "lightEmitter"
  | "localFrame"
  | "motionState";

export interface PluginRequirements {
  mainFocus?: readonly FocusCapabilityRequirement[];
}

export interface GamePlugin {
  id: string;
  capabilities?: readonly PluginCapabilityProvider[];
  controls?: ControlPlugin;
  loop?: LoopPlugin;
  segments?: SegmentPlugin;
  scene?: ScenePlugin;
  labels?: SceneLabelPlugin;
  simulation?: SimulationContribution;
  requirements?: PluginRequirements;
  viewControls?: ViewControlPlugin;
  views?: ViewPlugin;
  worldModel?: WorldModelPlugin;
}
