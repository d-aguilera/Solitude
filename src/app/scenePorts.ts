import type { EntityId } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Mat3 } from "../domain/mat3";
import type { Vec3 } from "../domain/vec3";

export interface BaseSceneObject {
  id: string;
  kind: SceneObjectKind;
  position: Vec3;
  orientation: Mat3;
  mesh: Mesh;
  color: RGB;
  lineWidth: number;
  wireframeOnly: boolean;
  applyTransform: boolean;
  backFaceCulling: boolean;
}

export interface CelestialBodySceneObject extends SolidSceneObject {
  kind: "planet" | "star";
  backFaceCulling: true;
  centralEntityId?: EntityId;
  velocity: Vec3;
}

export interface DomainCameraPose {
  position: Vec3;
  frame: LocalFrame;
}

export interface Mesh {
  points: Vec3[];
  faces: number[][];
  faceNormals?: Vec3[];
}

/**
 * Main view look state relative to the focused entity.
 */
export interface MainViewLookState {
  azimuth: number;
  elevation: number;
}

export interface PlanetSceneObject extends CelestialBodySceneObject {
  kind: "planet";
}

/**
 * Point light used by rendering adapters.
 */
export interface PointLight {
  position: Vec3;
  intensity: number;
}

export interface PolylineSceneObject extends BaseSceneObject {
  kind: "polyline";
  applyTransform: false;
  wireframeOnly: true;
  backFaceCulling: false;
  count: number;
  tail: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Scene {
  objects: SceneObject[];
  lights: PointLight[];
}

/**
 * Per-player scene control state that must persist across frames.
 */
export interface SceneControlState {
  mainViewLookState: MainViewLookState;
}

/**
 * Domain-level scene object union for rendering adapters.
 */
export type SceneObject =
  | ShipSceneObject
  | PlanetSceneObject
  | StarSceneObject
  | PolylineSceneObject;

export type SceneObjectKind = "ship" | "planet" | "polyline" | "star";

export interface SolidSceneObject extends BaseSceneObject {
  applyTransform: true;
  wireframeOnly: false;
}

export interface ShipSceneObject extends SolidSceneObject {
  kind: "ship";
  backFaceCulling: false;
}

export interface StarSceneObject extends CelestialBodySceneObject {
  kind: "star";
  luminosity: number; // W or scaled units for lighting
}
