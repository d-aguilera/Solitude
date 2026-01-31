import type {
  BodyId,
  BodyState,
  GravityEngine,
  GravityState,
  LocalFrame,
  Mat3,
  Mesh,
  PlanetPathMapping,
  Profiler,
  RGB,
  ShipBody,
  Vec3,
  World,
} from "../domain/domainPorts";
import type { PlanetTrajectory } from "./appInternals";

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

  /**
   * Constant axial rotation described by:
   *  - rotationAxis: unit vector in world space
   *  - angularSpeedRadPerSec: spin rate in radians per second
   *
   * The app layer is responsible for integrating the current spin angle
   * and updating orientation accordingly.
   */
  rotationAxis: Vec3;
  angularSpeedRadPerSec: number;
}

// --- Actions as canonical arrays ---

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
  "alignToVelocity",
] as const;

export const ALL_ENV_ACTIONS = ["pauseToggle", "profilingToggle"] as const;

// --- Types derived from arrays ---

export type ControlAction = (typeof ALL_CONTROL_ACTIONS)[number];
export type ControlInput = Record<ControlAction, boolean>;

export type EnvAction = (typeof ALL_ENV_ACTIONS)[number];
export type EnvInput = Record<EnvAction, boolean>;

export type DrawMode = "faces" | "lines";

export interface DomainCameraPose {
  position: Vec3;
  frame: LocalFrame;
}

/**
 * Binding between domain bodies and indices in the DomainWorld.
 */
export interface GravityBodyBinding {
  id: BodyId;
  kind: "ship" | "planet" | "star";
  shipIndex: number;
  planetIndex: number;
  starIndex: number;
}

export interface PlanetSceneObject extends CelestialBodySceneObject {
  kind: "planet";
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
 * Control-side profiling interface.
 *
 * Higher layers (app / infra) use this to configure and drive profiling.
 * Not intended to be depended on by domain logic.
 */
export interface ProfilerController {
  /**
   * Enable or disable profiling globally.
   */
  setEnabled(value: boolean): void;

  /**
   * Query whether profiling is currently enabled.
   */
  isEnabled(): boolean;

  /**
   * Signal paused/unpaused application state so profilers can suspend work.
   */
  setPaused(isPaused: boolean): void;

  /**
   * Advance any internal profiling window, if enabled.
   */
  check(): void;

  /**
   * Flush accumulated counters and timing data, if enabled.
   */
  flush(): void;
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

export interface SceneState {
  pilotCamera: DomainCameraPose;
  planetPathMappings: PlanetPathMapping[];
  planetTrajectories: PlanetTrajectory[];
  scene: Scene;
  speedMps: number;
  topCamera: DomainCameraPose;
  trajectoryAccumTime: number;
}

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

/**
 * Per-player simulation control state that must persist across frames.
 */
export interface SimControlState {
  alignToVelocity: boolean;
  thrustPercent: number;
}

export interface SimulationState {
  currentThrustPercent: number;
  gravityBindings: GravityBodyBinding[];
  gravityEngine: GravityEngine;
  gravityState: GravityState;
  mainShip: ShipBody;
  mainShipBodyState: BodyState;
  world: World;
}

export interface StarSceneObject extends CelestialBodySceneObject {
  kind: "star";
  luminosity: number; // W or scaled units for lighting
}

export type TickCallback = (
  params: Readonly<TickParams>,
) => Readonly<TickOutput>;

export interface TickParams {
  nowMs: number;
  controlInput: ControlInput;
  profiler: Profiler;
  paused: boolean;
}

export interface TickOutput {
  scene: Scene;
  mainShip: ShipBody;
  pilotCamera: DomainCameraPose;
  topCamera: DomainCameraPose;
  fps: number;
  currentThrustPercent: number;
  pilotCameraLocalOffset: Vec3;
  speedMps: number;
}
