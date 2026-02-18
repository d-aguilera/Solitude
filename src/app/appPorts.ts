import type {
  LocalFrame,
  Mat3,
  Mesh,
  RGB,
  ShipBody,
  Vec3,
} from "../domain/domainPorts";

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

export const ALL_ENV_ACTIONS = ["pauseToggle", "profilingToggle"] as const;

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

export interface GameplayParameters {
  simulationTimeScale: number;
}

/**
 * Pilot's view state relative to the controlled vehicle.
 */
export interface PilotLookState {
  azimuth: number;
  elevation: number;
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

/**
 * Base properties common to all scene objects used by renderers.
 */
export interface ShipSceneObject extends SolidSceneObject {
  kind: "ship";
  backFaceCulling: false;
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
  dtSeconds: number;
  controlInput: ControlInput;
}

export interface TickOutput {
  currentThrustLevel: number;
  mainShip: ShipBody;
  pilotCamera: DomainCameraPose;
  pilotCameraLocalOffset: Vec3;
  scene: Scene;
  simTimeSeconds: number; // accumulated simulation time in seconds.
  speedMps: number;
  topCamera: DomainCameraPose;
}
