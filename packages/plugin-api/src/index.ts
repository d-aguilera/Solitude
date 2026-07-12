import type { Vec3 } from "@solitude/engine/math";

export { raySphereFirstHitDistance, vec3 } from "@solitude/engine/math";
export type { Vec3 } from "@solitude/engine/math";

export const SOLITUDE_PLUGIN_API_VERSION = 1;
export const keyboardInputCapability = "solitude.keyboardInput.v1";

export type ExternalPluginEnvironment = "browser" | "server";
export type ExternalRuntimeOptions = Readonly<Record<string, string>>;
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
  plugins: readonly string[];
  schemaVersion: number;
}

export interface ExternalPluginCapabilityProvider {
  id: string;
  value: unknown;
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

export interface ExternalEntityCollisionSphere {
  id: ExternalEntityId;
  radius: number;
  state: {
    position: Vec3;
  };
}

export interface ExternalControlledBody {
  frame: {
    forward: Vec3;
  };
  id: ExternalEntityId;
  position: Vec3;
}

export interface ExternalWorld {
  collisionSpheres: readonly ExternalEntityCollisionSphere[];
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
  markers?: ExternalMarkerPlugin;
  requirements?: ExternalPluginRequirements;
  segments?: ExternalSegmentPlugin;
}

export type ExternalPluginFactory = (
  runtimeOptions: ExternalRuntimeOptions,
) => ExternalPlugin;

export interface ExternalPluginModule {
  createPlugin: ExternalPluginFactory;
}
