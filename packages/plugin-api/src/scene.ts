import type { ExternalPluginCapabilityRegistry } from "./capabilities";
import type { Mat3, Vec3 } from "./math";
import type { ExternalRenderMaterial, ExternalRgb } from "./render";
import type {
  ExternalEntityId,
  ExternalFocusContext,
  ExternalWorld,
} from "./world";

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
