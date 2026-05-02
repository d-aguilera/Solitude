import type { LocalFrame } from "./localFrame";
import type { Mat3 } from "./mat3";
import type { Vec3 } from "./vec3";

/**
 * ID of a generic world entity.
 */
export type EntityId = string;

export type LegacyEntityKind = "planet" | "ship" | "star";

export interface BodyState {
  id: EntityId;
  mass: number;
  velocity: Vec3;
}

/**
 * Angular velocity expressed as roll/pitch/yaw rates (rad/s).
 * Roll is about the controlled body's forward axis, pitch about right, yaw about up.
 */
export interface AngularVelocity {
  roll: number;
  pitch: number;
  yaw: number;
}

/**
 * Logical celestial body that participates in physics / gravity.
 */
export interface CelestialBody {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

export interface EntityRecord {
  id: EntityId;
  legacyKind?: LegacyEntityKind;
}

export interface EntityMotionState extends CelestialBody {
  orientation: Mat3;
}

export interface EntityGravityMass extends PhysicsBody {
  state: EntityMotionState;
}

export interface EntityCollisionSphere {
  id: EntityId;
  radius: number;
  state: EntityMotionState;
}

export interface EntityAxialSpin {
  id: EntityId;
  angularSpeedRadPerSec: number;
  rotationAxis: Vec3;
  state: EntityMotionState;
}

export interface EntityLightEmitter {
  id: EntityId;
  luminosity: number;
  state: EntityMotionState;
}

export interface ControlledBody extends EntityMotionState {
  angularVelocity: AngularVelocity;
  frame: LocalFrame;
}

/**
 * Celestial body with persistent axial spin state.
 */
export interface RotatingBody extends CelestialBody {
  orientation: Mat3;
  rotationAxis: Vec3;
  angularSpeedRadPerSec: number;
}

/**
 * Domain-level abstraction for gravitational integration.
 */
export interface GravityEngine {
  /**
   * Advance gravity simulation by dtSeconds.
   */
  step(dtSeconds: number, state: GravityState): void;
}

/**
 * Container for all gravitational bodies in the domain.
 */
export interface GravityState {
  bodyStates: BodyState[];
  positions: Vec3[];
}

/**
 * Physical properties for gravitational bodies.
 */
export interface PhysicsBody {
  id: string;
  density: number; // kg/m^3
  mass: number; // kg
}

/**
 * Physical properties of a planet / star body.
 */
export interface PlanetPhysics extends PhysicsBody {
  physicalRadius: number; // meters
}

/**
 * Physical properties of a controlled body.
 */
export interface ControlledBodyPhysics extends PhysicsBody {}

/**
 * Physical properties of a star body.
 */
export interface StarPhysics extends PlanetPhysics {
  luminosity: number; // W or scaled units for lighting
}

/**
 * Generalized world-state container for dynamic entities controlled by
 * the domain logic.
 */
export interface World {
  entities: EntityRecord[];
  entityIndex: Map<EntityId, EntityRecord>;
  entityStates: EntityMotionState[];
  gravityMasses: EntityGravityMass[];
  collisionSpheres: EntityCollisionSphere[];
  axialSpins: EntityAxialSpin[];
  controllableBodies: ControlledBody[];
  lightEmitters: EntityLightEmitter[];
}
