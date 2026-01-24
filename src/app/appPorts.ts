import type {
  BodyId,
  DomainWorld,
  LocalFrame,
  Mat3,
  Mesh,
  RGB,
  Vec3,
} from "../domain/domainPorts";
import type { ControlState } from "./appInternals";

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

export interface ControlInput {
  rollLeft: boolean;
  rollRight: boolean;
  pitchUp: boolean;
  pitchDown: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  lookLeft: boolean;
  lookRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
  lookReset: boolean;
  camForward: boolean;
  camBackward: boolean;
  camUp: boolean;
  camDown: boolean;
  burnForward: boolean;
  burnBackwards: boolean;
  thrust0: boolean;
  thrust1: boolean;
  thrust2: boolean;
  thrust3: boolean;
  thrust4: boolean;
  thrust5: boolean;
  thrust6: boolean;
  alignToVelocity: boolean;
}

export type DrawMode = "faces" | "lines";

export interface DomainCameraPose {
  position: Vec3;
  frame: LocalFrame;
}

/**
 * Environment-level input.
 */

export interface EnvInput {
  pauseToggle: boolean;
  profilingToggle: boolean;
}

export interface GameState {
  controlState: ControlState;
  scene: Scene;
  world: DomainWorld;
  mainShipId: string;
  pilotCamera: DomainCameraPose;
  topCamera: DomainCameraPose;
  pilotCameraLocalOffset: Vec3;
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

/**
 * Adapter‑agnostic HUD inputs.
 */
export interface HudRenderData {
  /**
   * Speed in meters per second for the controlled ship.
   */
  speedMps: number;
  /**
   * Latest measured frames per second.
   */
  fps: number;
  /**
   * Whether profiling is currently enabled.
   */
  profilingEnabled: boolean;
  /**
   * Pilot camera offset expressed in the ship's local frame.
   */
  pilotCameraLocalOffset: Vec3;
  /**
   * Signed thrust level in [-1, 1].
   */
  thrustPercent: number;
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

export type TickCallback = (params: TickParams) => GameState;

export interface TickParams {
  nowMs: number;
  controlInput: ControlInput;
  envInput: EnvInput;
  profilingEnabled: boolean;
}
