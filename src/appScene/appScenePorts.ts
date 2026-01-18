import type { Vec3, Mat3, Mesh, RGB } from "../domain/domainPorts";

export type SceneObjectKind = "airplane" | "planet" | "polyline" | "star";

/**
 * Base properties common to all scene objects used by renderers.
 */
export interface AirplaneSceneObject extends SolidSceneObject {
  kind: "airplane";
  backFaceCulling: false;
}

export interface BaseSceneObject {
  id: string;
  kind: SceneObjectKind;
  position: Vec3;
  orientation: Mat3;
  mesh: Mesh;
  scale: number;
  color: RGB;
  lineWidth: number;
  wireframeOnly: boolean;
  applyTransform: boolean;
  backFaceCulling: boolean;
}

export interface CelestialBodySceneObject extends SolidSceneObject {
  kind: "planet" | "star";
  initialVelocity: Vec3;
  physicalRadius: number; // meters
  backFaceCulling: true;
  velocity: Vec3;
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
}

/**
 * Adapter-level scene used by renderers.
 */
export interface Scene {
  objects: SceneObject[];
  lights: PointLight[];
}

/**
 * Domain-level scene object union for rendering adapters.
 */
export type SceneObject =
  | AirplaneSceneObject
  | PlanetSceneObject
  | StarSceneObject
  | PolylineSceneObject;

export interface SolidSceneObject extends BaseSceneObject {
  applyTransform: true;
  wireframeOnly: false;
}

export interface StarSceneObject extends CelestialBodySceneObject {
  kind: "star";
  luminosity: number; // W or scaled units for lighting
}
