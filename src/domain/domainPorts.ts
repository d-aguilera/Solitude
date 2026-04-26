import type { LocalFrame } from "./localFrame";
import type { Mat3 } from "./mat3";
import type { Vec3 } from "./vec3";

/**
 * ID of a logical body participating in gravity.
 */
export type BodyId = string;

/**
 * ID of a generic world entity. Scenario-specific prefixes such as
 * "ship:" or "planet:" are naming conventions, not core categories.
 */
export type EntityId = BodyId;

export interface BodyState {
  id: BodyId;
  mass: number;
  velocity: Vec3;
}

/**
 * Angular velocity expressed as roll/pitch/yaw rates (rad/s).
 * Roll is about the ship's forward axis, pitch about right, yaw about up.
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
 * Domain-level ship body.
 */
export interface ShipBody extends CelestialBody {
  frame: LocalFrame;
  orientation: Mat3;
  angularVelocity: AngularVelocity;
}

/**
 * Physical properties of a ship body.
 */
export interface ShipPhysics extends PhysicsBody {}

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
  ships: ShipBody[];
  shipPhysics: ShipPhysics[];
  planets: RotatingBody[];
  planetPhysics: PlanetPhysics[];
  stars: RotatingBody[];
  starPhysics: StarPhysics[];
}
