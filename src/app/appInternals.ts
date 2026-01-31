import type {
  BodyId,
  BodyState,
  GravityEngine,
  GravityState,
  LocalFrame,
  PlanetKind,
  Polar2D,
  RGB,
  ShipBody,
  Vec3,
  World,
} from "../domain/domainPorts.js";
import type { DomainCameraPose, Scene } from "./appPorts.js";
import type { Vec3RingBuffer } from "./Vec3RingBuffer.js";

/**
 * Shared configuration for bodies that participate in orbits.
 */
export interface CelestialBodyConfig {
  id: string; // domain id, e.g. "planet:earth"
  pathId: string; // orbit path id, purely logical association
  kind: PlanetKind;

  // Physical orbital elements / body properties (SI units)
  orbit: Polar2D; // angleRad + physical radius in meters (semi-major axis, assumed circular)
  physicalRadius: number; // meters
  density: number; // kg/m^3

  // Rendering / initial kinematics
  tangentialSpeed: number; // m/s, orbital speed along local tangent
  color: RGB;

  /**
   * Axial rotation:
   *  - rotationAxis is a unit vector in world space (e.g. approximate spin axis)
   *  - angularSpeedRadPerSec is the constant spin rate around that axis
   */
  rotationAxis: { x: number; y: number; z: number };
  angularSpeedRadPerSec: number;
}

export const colors: { [key: string]: RGB } = {
  ship: { r: 0, g: 255, b: 255 },
  earth: { r: 80, g: 120, b: 255 },
  jupiter: { r: 220, g: 180, b: 120 },
  mars: { r: 255, g: 80, b: 50 },
  mercury: { r: 180, g: 180, b: 180 },
  neptune: { r: 80, g: 120, b: 255 },
  saturn: { r: 220, g: 200, b: 150 },
  sun: { r: 255, g: 230, b: 120 },
  uranus: { r: 160, g: 220, b: 240 },
  venus: { r: 255, g: 220, b: 160 },
  yellow: { r: 255, g: 255, b: 0 },
};

/**
 * Simple container for the controlled body's pose and velocity.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  velocity: Vec3;
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

export interface PlanetBodyConfig extends CelestialBodyConfig {
  kind: "planet";
}

export type PlanetTrajectory = {
  buffers: Vec3RingBuffer[];
};

export interface RingBuffer<T> {
  /** Fixed capacity of the buffer. */
  readonly capacity: number;

  /** Number of elements currently in the buffer. */
  readonly count: number;

  /** Index of newest element. */
  readonly tail: number;

  /**
   * Append a new element as the newest entry.
   *
   * - If buffer is not full, this increases `count`.
   * - If buffer is full, this overwrites the oldest element.
   *
   * Returns the evicted element when overwriting, or `undefined` if nothing was evicted.
   */
  push(value: T): T | undefined;

  /**
   * Iterate from tail to head (newest → oldest).
   */
  forEach(fn: (value: T) => void): void;
}

export interface SceneState {
  pilotCamera: DomainCameraPose;
  planetPathMappings: Record<BodyId, BodyId>;
  planetTrajectories: Record<BodyId, PlanetTrajectory>;
  scene: Scene;
  speedMps: number;
  topCamera: DomainCameraPose;
  trajectoryAccumTime: number;
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

export interface StarBodyConfig extends CelestialBodyConfig {
  kind: "star";
  luminosity: number; // W (or scaled W) for stars
}
