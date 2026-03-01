import type { BodyId, KeplerianOrbit, ShipBody } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Mat3 } from "../domain/mat3";
import type { Vec3 } from "../domain/vec3";

export const AU = 1.495978707e11; // m
export const C = 299_792_458; // m/s
export const km = 1_000;

export const ALL_CONTROL_ACTIONS = [
  "rollLeft",
  "rollRight",
  "pitchUp",
  "pitchDown",
  "yawLeft",
  "yawRight",
  "lookLeft",
  "lookRight",
  "lookUp",
  "lookDown",
  "lookReset",
  "camForward",
  "camBackward",
  "camUp",
  "camDown",
  "burnForward",
  "burnBackwards",
  "thrust0",
  "thrust1",
  "thrust2",
  "thrust3",
  "thrust4",
  "thrust5",
  "thrust6",
  "thrust7",
  "thrust8",
  "thrust9",
  "alignToVelocity",
] as const;

export const ALL_ENV_ACTIONS = [
  "decreaseTimeScale",
  "increaseTimeScale",
  "pauseToggle",
  "profilingToggle",
] as const;

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

export interface CelestialBodyConfig {
  id: string; // domain id, e.g. "planet:earth"
  kind: CelestialBodyKind;

  /**
   * Keplerian orbital elements relative to a chosen central body.
   *
   * All distances are in meters and all angles in radians.
   *
   * The application is responsible for interpreting these elements in a
   * specific reference frame and for using them to derive initial position
   * and velocity at the epoch.
   */
  orbit: KeplerianOrbit;

  // Physical body properties (SI units)
  physicalRadius: number; // meters
  density: number; // kg/m^3

  /**
   * ID of the central body that dominates this orbit.
   *
   * For heliocentric planetary orbits this is the Sun's id.
   * For moons this is the id of the parent planet.
   * For a root body (e.g. Sun at origin) this should be equal to its own id.
   */
  centralBodyId: BodyId;

  // Rendering
  color: RGB;
  mesh: Mesh;

  /**
   * Axial rotation:
   *  - obliquityRad is the angle (in radians) between the spin axis and
   *    the orbital plane normal.
   *  - angularSpeedRadPerSec is the constant spin rate around that axis.
   *
   * The application is responsible for deriving a concrete rotation axis
   * from the orbit geometry and this obliquity.
   */
  obliquityRad: number;
  angularSpeedRadPerSec: number;
}

export type CelestialBodyKind = "planet" | "star";

export interface CelestialBodySceneObject extends SolidSceneObject {
  kind: "planet" | "star";
  backFaceCulling: true;
  velocity: Vec3;
  rotationAxis: Vec3; // world space
  angularSpeedRadPerSec: number; // spin rate in radians per second
}

export type ControlAction = (typeof ALL_CONTROL_ACTIONS)[number];
export type ControlInput = Record<ControlAction, boolean>;

export interface DomainCameraPose {
  position: Vec3;
  frame: LocalFrame;
}

export type EnvAction = (typeof ALL_ENV_ACTIONS)[number];
export type EnvInput = Record<EnvAction, boolean>;

export interface PlanetSceneObject extends CelestialBodySceneObject {
  kind: "planet";
}

export interface Mesh {
  points: Vec3[];
  faces: number[][];
  faceNormals?: Vec3[];
}

/**
 * Pilot's view state relative to the controlled vehicle.
 */
export interface PilotLookState {
  azimuth: number;
  elevation: number;
}

export interface PlanetBodyConfig extends CelestialBodyConfig {
  kind: "planet";
  pathId: string; // orbit path id, purely logical association
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
  look: PilotLookState;
  pilotCameraLocalOffset: Vec3;
  topCameraLocalOffset: Vec3;
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

export interface ShipBodyConfig {
  altitude: number;
  color: RGB;
  homePlanetId: string;
  id: string;
  mesh: Mesh;
}

export interface ShipSceneObject extends SolidSceneObject {
  kind: "ship";
  backFaceCulling: false;
}

export interface StarBodyConfig extends CelestialBodyConfig {
  kind: "star";
  luminosity: number; // W (or scaled W) for stars
}

export interface StarSceneObject extends CelestialBodySceneObject {
  kind: "star";
  luminosity: number; // W or scaled units for lighting
}

export type TickCallback = (
  output: Readonly<TickOutput>,
  params: Readonly<TickParams>,
) => void;

export interface TickParams {
  dtMillis: number;
  dtMillisSim: number;
  controlInput: ControlInput;
}

export interface TickOutput {
  currentThrustLevel: number;
  mainShip: ShipBody;
  pilotCamera: DomainCameraPose;
  pilotCameraLocalOffset: Vec3;
  scene: Scene;
  simTimeMillis: number; // accumulated simulation time.
  speedMps: number;
  topCamera: DomainCameraPose;
}

export interface WorldAndSceneConfig {
  enemyyShipId: string;
  mainShipId: string;
  planets: (PlanetBodyConfig | StarBodyConfig)[];
  ships: ShipBodyConfig[];
}
