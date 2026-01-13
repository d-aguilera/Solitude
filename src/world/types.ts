import type {
  CameraPose,
  DomainScene,
  DomainSceneObject,
  DomainWorld,
  LocalFrame as DomainLocalFrame,
  Mesh as DomainMesh,
  PlaneBody,
  PointLight as DomainPointLight,
  RGB as DomainRGB,
  Vec3 as DomainVec3,
} from "./domain.js";

export type Vec3 = DomainVec3;
export type RGB = DomainRGB;
export type Mesh = DomainMesh;
export type LocalFrame = DomainLocalFrame;
export type PointLight = DomainPointLight;

export {
  Polar2D,
  BodyId,
  BodyState,
  GravityBodyBinding,
  GravityState,
} from "./domain.js";

/**
 * Adapter-level plane view used by app and rendering.
 *
 * This is a thin DTO around the domain PlaneBody.
 */
export interface Plane extends PlaneBody {
  speed: number;
}

/**
 * Camera adapter type; identical to domain but kept separate so
 * outer layers can evolve without affecting the core domain.
 */
export type Camera = CameraPose;

export interface PilotView {
  id: string;
  planeId: string;
  azimuth: number;
  elevation: number;
}

type SceneObjectKind = "airplane" | "planet" | "polyline" | "star";

/**
 * Base properties common to all scene objects.
 */
interface BaseSceneObject extends DomainSceneObject {
  kind: SceneObjectKind;
  lineWidth: number;
  wireframeOnly: boolean;
  applyTransform: boolean;
  backFaceCulling: boolean;
}

export interface SolidSceneObject extends BaseSceneObject {
  applyTransform: true;
  wireframeOnly: false;
}

/**
 * Airplane visual object.
 */
export interface AirplaneSceneObject extends SolidSceneObject {
  kind: "airplane";
  backFaceCulling: false;
}

/**
 * Planet / star body included in gravity simulation.
 */
export interface PlanetSceneObject extends SolidSceneObject {
  kind: "planet";
  initialVelocity: Vec3;
  physicalRadius: number; // meters
  backFaceCulling: true;
  velocity: Vec3;
}

/**
 * Star body included in gravity simulation and also contributes light.
 */
export interface StarSceneObject extends SolidSceneObject {
  kind: "star";
  initialVelocity: Vec3;
  physicalRadius: number; // meters
  backFaceCulling: true;
  velocity: Vec3;
  luminosity: number; // W or scaled units for lighting
}

/**
 * Generic polyline / path object (orbit paths, plane trajectory).
 * World-space points; no transform applied; not part of gravity.
 */
export interface PolylineSceneObject extends BaseSceneObject {
  kind: "polyline";
  applyTransform: false;
  wireframeOnly: true;
  backFaceCulling: false;
}

/**
 * Union of all scene object variants.
 */
export type SceneObject =
  | AirplaneSceneObject
  | PlanetSceneObject
  | StarSceneObject
  | PolylineSceneObject;

/**
 * Adapter-level scene used by renderers.
 */
export interface Scene extends DomainScene {
  objects: SceneObject[];
}

// Renderer-side cache; may be attached to any SceneObject.
export type SceneObjectWithCache = SceneObject & {
  __worldPointsCache?: Vec3[];
  __cameraPointsCache?: Vec3[];
  __cameraCacheFrameId?: number;
  __worldFaceNormalsCache?: Vec3[];
  __faceNormalsFrameId?: number;
};

// Small adapter that lets callers plug in any profiling / tracing / instrumentation
// without direct coupling to a concrete instrumentation API.
export type Profiler = {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
};

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}

export type DrawMode = "faces" | "lines";

/**
 * Adapter-level world state used by the app and renderer.
 *
 * This is a thin wrapper around DomainWorld so that outer layers do
 * not depend on the raw domain container directly.
 */
export interface WorldState extends DomainWorld {
  planes: Plane[];
}
