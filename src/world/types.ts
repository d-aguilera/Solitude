import type {
  DomainScene,
  DomainSceneObject,
  DomainWorld,
  PlaneBody,
  Vec3,
} from "./domain.js";

/**
 * Adapter-level plane view used by app and rendering.
 *
 * This is a thin DTO around the domain PlaneBody.
 */
export interface Plane extends PlaneBody {
  speed: number;
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
 * Celestial body included in gravity simulation.
 */
export interface CelestialBodySceneObject extends SolidSceneObject {
  kind: "planet" | "star";
  initialVelocity: Vec3;
  physicalRadius: number; // meters
  backFaceCulling: true;
  velocity: Vec3;
}

/**
 * Planet included in gravity simulation.
 */
export interface PlanetSceneObject extends CelestialBodySceneObject {
  kind: "planet";
}

/**
 * Star included in gravity simulation and also contributes light.
 */
export interface StarSceneObject extends CelestialBodySceneObject {
  kind: "star";
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

/**
 * Adapter-level world state used by the app and renderer.
 *
 * This wraps the DomainWorld so that outer layers do not depend on
 * the raw domain container directly.
 */
export interface WorldState extends DomainWorld {
  planes: Plane[];
}
