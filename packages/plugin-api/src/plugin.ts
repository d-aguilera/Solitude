import type { Mat3, Vec3 } from "./math";
export type { EntityNameProvider as ExternalEntityNameProvider } from "@solitude/entity-names";

export type ExternalRuntimeOptions = Readonly<Record<string, string>>;
export type ExternalEntityId = string;
export type ExternalControlAction = string;
export type ExternalControlInput = Record<ExternalControlAction, boolean>;

export interface ExternalPluginCapabilityProvider {
  id: string;
  value: unknown;
}

export interface ExternalPluginCapabilityRegistry {
  getAll: (id: string) => readonly unknown[];
}

export interface ExternalKeyHandler {
  handleKeyDown: (action: ExternalControlAction, isRepeat: boolean) => boolean;
  handleKeyUp: (action: ExternalControlAction) => boolean;
}

export interface ExternalKeyboardInputProvider {
  actions?: readonly ExternalControlAction[];
  keyMap?: Readonly<Record<string, ExternalControlAction>>;
  createKeyHandler?: (controlInput: ExternalControlInput) => ExternalKeyHandler;
}

export type ExternalHudColumnId =
  | "left"
  | "leftCenter"
  | "center"
  | "rightCenter"
  | "right";

export interface ExternalHudGrid {
  addLine: (column: ExternalHudColumnId, key: string, text: string) => void;
  appendLine: (
    column: ExternalHudColumnId,
    key: string,
    text: string,
    separator: string,
  ) => void;
}

export interface ExternalHudContext {
  capabilityRegistry: ExternalPluginCapabilityRegistry;
  controlInput: ExternalControlInput;
  mainFocus: ExternalFocusContext;
  nowMs: number;
  simTimeMillis: number;
  world: ExternalWorld;
}

export interface ExternalHudPanelProvider {
  writeHud: (grid: ExternalHudGrid, context: ExternalHudContext) => void;
}

export interface ExternalPresentationFrameContext {
  dtMillis: number;
  nowMs: number;
}

export interface ExternalPresentationFrameProvider {
  updatePresentationFrame: (context: ExternalPresentationFrameContext) => void;
}

export interface ExternalMultiplayerSessionProvider {
  getEntityId: () => string;
  getGameId: () => string;
}

export interface ExternalSpacecraftOperatorTelemetry {
  currentRcsLevel: number;
  currentThrustLevel: number;
}

export interface ExternalSpacecraftOperatorTelemetryProvider {
  readonly telemetry: ExternalSpacecraftOperatorTelemetry;
}

export type ExternalRenderTextureSourceCatalog = Readonly<
  Record<string, string>
>;

export interface ExternalRenderTextureSourcesProvider {
  textureSources: ExternalRenderTextureSourceCatalog;
}

export interface ExternalEntityMotionState {
  id: ExternalEntityId;
  position: Vec3;
  velocity: Vec3;
}

export interface ExternalEntityCollisionSphere {
  id: ExternalEntityId;
  radius: number;
  state: ExternalEntityMotionState;
}

export interface ExternalGravityMass {
  id: ExternalEntityId;
  mass: number;
  state: ExternalEntityMotionState;
}

export interface ExternalLocalFrame {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

export interface ExternalControlledBody extends ExternalEntityMotionState {
  frame: ExternalLocalFrame;
}

export interface ExternalWorld {
  collisionSpheres: readonly ExternalEntityCollisionSphere[];
  controllableBodies: readonly ExternalControlledBody[];
  entityStates: readonly ExternalEntityMotionState[];
  gravityMasses: readonly ExternalGravityMass[];
}

export interface ExternalGravityPrimary {
  body: ExternalEntityMotionState;
  id: ExternalEntityId;
  mass: number;
  radius: number;
}

export interface ExternalFocusContext {
  controlledBody: ExternalControlledBody;
  entityId: ExternalEntityId;
}

export interface ExternalSegmentProviderParams {
  mainFocus: ExternalFocusContext;
  world: ExternalWorld;
}

export interface ExternalWorldSegment {
  start: Vec3;
  end: Vec3;
  color: ExternalRgb;
  lineWidth: number;
}

export interface ExternalWorldSegmentSink {
  readonly count: number;
  readonly items: readonly ExternalWorldSegment[];
  addSegment: (
    start: Vec3,
    end: Vec3,
    color: ExternalRgb,
    lineWidth: number,
  ) => ExternalWorldSegment;
  reset: () => void;
}

export type ExternalWorldMarkerShape = "cross" | "dot" | "ring";

export interface ExternalWorldMarker {
  position: Vec3;
  color: ExternalRgb;
  radius: number;
  lineWidth: number;
  shape: ExternalWorldMarkerShape;
}

export interface ExternalWorldMarkerSink {
  readonly count: number;
  readonly items: readonly ExternalWorldMarker[];
  addMarker: (
    position: Vec3,
    color: ExternalRgb,
    radius: number,
    lineWidth: number,
    shape: ExternalWorldMarkerShape,
  ) => ExternalWorldMarker;
  reset: () => void;
}

export interface ExternalRgb {
  r: number;
  g: number;
  b: number;
}

export type ExternalRenderMaterial =
  | { kind: "solidColor" }
  | {
      kind: "sphericalTexture";
      textureId: string;
      longitudeOffsetRad?: number;
      cloudTextureId?: string;
      cloudOpacity?: number;
      cloudScale?: number;
      atmosphere?: {
        color: ExternalRgb;
        opacity: number;
        scale: number;
      };
    };

export interface ExternalSceneObject {
  centralEntityId?: ExternalEntityId;
  displayName?: string;
  id: ExternalEntityId;
  kind?: "controlledBody" | "lightEmitter" | "orbitalBody" | "polyline";
  material?: ExternalRenderMaterial;
  position?: Vec3;
  velocity?: Vec3;
}

export interface ExternalPolylineSceneObject extends ExternalSceneObject {
  applyTransform: false;
  backFaceCulling: false;
  color: ExternalRgb;
  count: number;
  kind: "polyline";
  lineWidth: number;
  mesh: {
    faces: number[][];
    points: Vec3[];
  };
  meshLod: { kind: "none" };
  meshScale: number;
  meshShading: { kind: "flat" };
  orientation: Mat3;
  position: Vec3;
  tail: number;
  wireframeOnly: true;
}

export interface ExternalScene {
  objects: ExternalSceneObject[];
}

export interface ExternalKeplerianOrbit {
  eccentricity: number;
  semiMajorAxis: number;
}

export type ExternalEntityStateConfig =
  | { kind: "direct" }
  | {
      centralEntityId: ExternalEntityId;
      kind: "keplerian";
      orbit: ExternalKeplerianOrbit;
    };

export interface ExternalEntityConfig {
  components: {
    lightEmitter?: unknown;
    renderable?: { color: ExternalRgb };
    state?: ExternalEntityStateConfig;
  };
  id: ExternalEntityId;
}

export interface ExternalWorldAndSceneConfig {
  entities: readonly ExternalEntityConfig[];
}

export interface ExternalSceneInitParams {
  config: ExternalWorldAndSceneConfig;
  scene: ExternalScene;
  world: ExternalWorld;
}

export interface ExternalSceneUpdateParams {
  dtSimMillis: number;
}

export interface ExternalScenePlugin {
  initScene?: (params: ExternalSceneInitParams) => void;
  updateScene?: (params: ExternalSceneUpdateParams) => void;
}

export interface ExternalSceneLabelCandidate {
  anchor: Vec3;
  id: string;
  lines: readonly string[];
  parentId?: ExternalEntityId;
  priority?: number;
}

export interface ExternalSceneLabelSink {
  readonly count: number;
  readonly items: readonly ExternalSceneLabelCandidate[];
  addLabel: (
    id: string,
    anchor: Vec3,
    lines: readonly string[],
    parentId?: ExternalEntityId,
    priority?: number,
  ) => ExternalSceneLabelCandidate;
  reset: () => void;
}

export interface ExternalSceneLabelProviderParams {
  capabilityRegistry: ExternalPluginCapabilityRegistry;
  config: ExternalWorldAndSceneConfig;
  labelMode: "full" | "nameOnly";
  mainFocus: ExternalFocusContext;
  scene: ExternalScene;
  viewId: string;
  world: ExternalWorld;
}

export interface ExternalSceneLabelPlugin {
  appendLabels?: (
    into: ExternalSceneLabelSink,
    params: ExternalSceneLabelProviderParams,
  ) => void;
}

export type ExternalViewLayout =
  | { kind: "primary" }
  | {
      avoidHud?: boolean;
      horizontal: "left" | "right";
      kind: "pip";
      vertical: "top" | "bottom";
    };

export interface ExternalMainViewLookState {
  azimuth: number;
  elevation: number;
}

export interface ExternalViewFrameUpdateParams {
  frame: ExternalLocalFrame;
  mainFocus: ExternalFocusContext;
  mainViewLookState: ExternalMainViewLookState;
}

export interface ExternalViewDefinition {
  id: string;
  initialCameraOffset: Vec3;
  labelMode: "full" | "nameOnly";
  layout: ExternalViewLayout;
  title?: string;
  updateFrame: (params: ExternalViewFrameUpdateParams) => void;
}

export interface ExternalMainViewCameraRig {
  id: string;
  updateFrame: (params: ExternalViewFrameUpdateParams) => void;
}

export interface ExternalViewRegistry {
  addMainViewCameraRig: (rig: ExternalMainViewCameraRig) => void;
  addView: (view: ExternalViewDefinition) => void;
}

export interface ExternalViewRegistrationParams {
  config: ExternalWorldAndSceneConfig;
}

export interface ExternalViewPlugin {
  registerViews: (
    registry: ExternalViewRegistry,
    params: ExternalViewRegistrationParams,
  ) => void;
}

export interface ExternalSceneControlState {
  mainViewLookState: ExternalMainViewLookState;
}

export interface ExternalPrimaryViewState {
  cameraOffset: Vec3;
}

export interface ExternalViewControlSceneState {
  primaryView: ExternalPrimaryViewState;
}

export interface ExternalViewControlUpdateParams {
  controlInput: ExternalControlInput;
  dtMillis: number;
  mainFocus: ExternalFocusContext;
  sceneControlState: ExternalSceneControlState;
  sceneState: ExternalViewControlSceneState;
}

export interface ExternalViewControlPlugin {
  updateViewControls?: (params: ExternalViewControlUpdateParams) => void;
}

export interface ExternalSegmentPlugin {
  appendSegments?: (
    into: ExternalWorldSegmentSink,
    params: ExternalSegmentProviderParams,
  ) => void;
}

export interface ExternalMarkerPlugin {
  appendMarkers?: (
    into: ExternalWorldMarkerSink,
    params: ExternalSegmentProviderParams,
  ) => void;
}

export type ExternalFocusCapabilityRequirement =
  | "angularVelocity"
  | "collisionSphere"
  | "controlledBody"
  | "gravityMass"
  | "lightEmitter"
  | "localFrame"
  | "motionState";

export interface ExternalPluginRequirements {
  mainFocus?: readonly ExternalFocusCapabilityRequirement[];
}

export interface ExternalPlugin {
  capabilities?: readonly ExternalPluginCapabilityProvider[];
  id: string;
  labels?: ExternalSceneLabelPlugin;
  markers?: ExternalMarkerPlugin;
  requirements?: ExternalPluginRequirements;
  scene?: ExternalScenePlugin;
  segments?: ExternalSegmentPlugin;
  viewControls?: ExternalViewControlPlugin;
  views?: ExternalViewPlugin;
}

export type ExternalPluginFactory = (
  runtimeOptions: ExternalRuntimeOptions,
) => ExternalPlugin;

export interface ExternalPluginModule {
  createPlugin: ExternalPluginFactory;
}
