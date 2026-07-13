import { vec3, type Mat3, type Vec3 } from "@solitude/engine/math";

export {
  EPS_ECCENTRICITY,
  EPS_LEN,
  EPS_LEN_COARSE,
  EPS_SPEED_COARSE,
  EPS_SPEED_FINE,
  EPS_SPEED_SQ,
  EPS_TIME_SEC,
  mat3,
  raySphereFirstHitDistance,
  vec3,
} from "@solitude/engine/math";
export type { Mat3, Vec3 } from "@solitude/engine/math";

export const SOLITUDE_PLUGIN_API_VERSION = 1;
export const keyboardInputCapability = "solitude.keyboardInput.v1";
export const entityNameProviderCapability = "solitude.entityNameProvider.v1";
export const hudPanelCapability = "solitude.hud.panel.v1";
export const presentationFrameCapability =
  "solitude.browser.presentationFrame.v1";
export const renderTextureSourcesCapability =
  "solitude.render.textureSources.v1";
export const spacecraftOperatorTelemetryCapability =
  "spacecraft.operatorTelemetry.v1";

export type ExternalPluginEnvironment = "browser" | "server";
export type ExternalRuntimeOptions = Readonly<Record<string, string>>;
export type ExternalLocale = "en" | "es" | "fr";
export type ExternalEntityId = string;
export type ExternalControlAction = string;
export type ExternalControlInput = Record<ExternalControlAction, boolean>;

export interface ExternalPluginManifest {
  apiVersion: number;
  entry: string;
  environment: ExternalPluginEnvironment;
  id: string;
  schemaVersion: number;
}

export interface ExternalPluginSetManifest {
  packs: readonly string[];
  schemaVersion: number;
}

export interface ExternalPluginLoaderConfig {
  allowedOrigins: readonly string[];
  pluginSet: string;
  schemaVersion: number;
}

export interface ExternalPluginPackManifest {
  id: string;
  plugins: readonly string[];
  schemaVersion: number;
}

export interface ExternalPluginCapabilityProvider {
  id: string;
  value: unknown;
}

export interface ExternalPluginCapabilityRegistry {
  getAll: (id: string) => readonly unknown[];
}

export interface ExternalEntityNameProvider {
  formatEntityName: (entityId: ExternalEntityId) => string | null;
}

export function createEntityNameProvider(
  provider: ExternalEntityNameProvider,
): ExternalPluginCapabilityProvider {
  return { id: entityNameProviderCapability, value: provider };
}

export function formatEntityName(
  capabilityRegistry: ExternalPluginCapabilityRegistry,
  entityId: ExternalEntityId,
  explicitDisplayName: string | undefined,
): string {
  if (explicitDisplayName) return explicitDisplayName;
  for (const value of capabilityRegistry.getAll(entityNameProviderCapability)) {
    if (!isEntityNameProvider(value)) continue;
    const formatted = value.formatEntityName(entityId);
    if (formatted != null) return formatted;
  }
  const separatorIndex = entityId.lastIndexOf(":");
  const raw =
    separatorIndex >= 0 ? entityId.slice(separatorIndex + 1) : entityId;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function isEntityNameProvider(
  value: unknown,
): value is ExternalEntityNameProvider {
  const candidate = value as Partial<ExternalEntityNameProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.formatEntityName === "function"
  );
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

export function createKeyboardInputCapability(
  provider: ExternalKeyboardInputProvider,
): ExternalPluginCapabilityProvider {
  return { id: keyboardInputCapability, value: provider };
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

export function createHudPanelCapability(
  provider: ExternalHudPanelProvider,
): ExternalPluginCapabilityProvider {
  return { id: hudPanelCapability, value: provider };
}

export function isHudPanelProvider(
  value: unknown,
): value is ExternalHudPanelProvider {
  const candidate = value as Partial<ExternalHudPanelProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.writeHud === "function"
  );
}

export interface ExternalPresentationFrameContext {
  dtMillis: number;
  nowMs: number;
}

export interface ExternalPresentationFrameProvider {
  updatePresentationFrame: (context: ExternalPresentationFrameContext) => void;
}

export function createPresentationFrameCapability(
  provider: ExternalPresentationFrameProvider,
): ExternalPluginCapabilityProvider {
  return { id: presentationFrameCapability, value: provider };
}

export function isPresentationFrameProvider(
  value: unknown,
): value is ExternalPresentationFrameProvider {
  const candidate = value as Partial<ExternalPresentationFrameProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.updatePresentationFrame === "function"
  );
}

export interface ExternalSpacecraftOperatorTelemetry {
  currentRcsLevel: number;
  currentThrustLevel: number;
}

export interface ExternalSpacecraftOperatorTelemetryProvider {
  readonly telemetry: ExternalSpacecraftOperatorTelemetry;
}

export function createSpacecraftOperatorTelemetryProvider(
  telemetry: ExternalSpacecraftOperatorTelemetry,
): ExternalPluginCapabilityProvider {
  return {
    id: spacecraftOperatorTelemetryCapability,
    value: { telemetry } satisfies ExternalSpacecraftOperatorTelemetryProvider,
  };
}

export function isSpacecraftOperatorTelemetryProvider(
  value: unknown,
): value is ExternalSpacecraftOperatorTelemetryProvider {
  const candidate =
    value as Partial<ExternalSpacecraftOperatorTelemetryProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.telemetry === "object" &&
    candidate.telemetry !== null &&
    typeof candidate.telemetry.currentThrustLevel === "number" &&
    typeof candidate.telemetry.currentRcsLevel === "number"
  );
}

export function readLocaleRuntimeOption(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalLocale {
  const locale = runtimeOptions.locale;
  if (!locale) return "en";
  const language = locale.split("-")[0]?.toLowerCase();
  if (language === "es" || language === "fr") return language;
  return "en";
}

export type ExternalRenderTextureSourceCatalog = Readonly<
  Record<string, string>
>;

export interface ExternalRenderTextureSourcesProvider {
  textureSources: ExternalRenderTextureSourceCatalog;
}

export function createRenderTextureSourcesCapability(
  textureSources: ExternalRenderTextureSourceCatalog,
): ExternalPluginCapabilityProvider {
  return {
    id: renderTextureSourcesCapability,
    value: { textureSources } satisfies ExternalRenderTextureSourcesProvider,
  };
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

export function getDominantBodyPrimary(
  world: ExternalWorld,
  position: Vec3,
): ExternalGravityPrimary | null {
  let best: ExternalGravityPrimary | null = null;
  let bestAccelerationFactor = Number.NEGATIVE_INFINITY;
  for (const sphere of world.collisionSpheres) {
    const gravityMass = findGravityMass(world.gravityMasses, sphere.id);
    if (!gravityMass) continue;
    const distanceSq = vec3.distSq(sphere.state.position, position);
    const accelerationFactor =
      distanceSq === 0 ? 0 : gravityMass.mass / distanceSq;
    if (accelerationFactor <= bestAccelerationFactor) continue;
    bestAccelerationFactor = accelerationFactor;
    best = {
      body: sphere.state,
      id: sphere.id,
      mass: gravityMass.mass,
      radius: sphere.radius,
    };
  }
  return best;
}

export function computeStandardGravitationalParameter(mass: number): number {
  return 6.6743e-11 * mass;
}

function findGravityMass(
  gravityMasses: readonly ExternalGravityMass[],
  id: ExternalEntityId,
): ExternalGravityMass | null {
  for (const gravityMass of gravityMasses) {
    if (gravityMass.id === id) return gravityMass;
  }
  return null;
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
