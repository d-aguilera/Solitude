import type { AngularVelocity, BodyId } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Mat3 } from "../domain/mat3";
import type { Vec3 } from "../domain/vec3";
import type { KeplerianOrbit } from "./physicsConfigPorts";
import type { Mesh, RGB } from "./scenePorts";

export type EntityId = string;

export type LegacyEntityKind = "planet" | "ship" | "star";

export interface EntityMetadataConfig {
  legacyKind?: LegacyEntityKind;
  tags?: string[];
}

export interface DirectEntityStateConfig {
  angularVelocity?: AngularVelocity;
  frame?: LocalFrame;
  kind: "direct";
  orientation: Mat3;
  position: Vec3;
  velocity: Vec3;
}

export interface KeplerianEntityStateConfig {
  centralBodyId: BodyId;
  kind: "keplerian";
  orbit: KeplerianOrbit;
}

export type EntityStateConfig =
  | DirectEntityStateConfig
  | KeplerianEntityStateConfig;

export interface GravityMassConfig {
  density: number;
  mass?: number;
  physicalRadius?: number;
  volume?: number;
}

export interface CollisionSphereConfig {
  radius: number;
}

export interface RenderableConfig {
  color: RGB;
  mesh: Mesh;
}

export interface LightEmitterConfig {
  luminosity: number;
}

export interface AxialSpinConfig {
  angularSpeedRadPerSec: number;
  obliquityRad: number;
}

export interface ControllableConfig {
  enabled: true;
}

export interface EntityComponentsConfig {
  axialSpin?: AxialSpinConfig;
  collisionSphere?: CollisionSphereConfig;
  controllable?: ControllableConfig;
  gravityMass?: GravityMassConfig;
  lightEmitter?: LightEmitterConfig;
  renderable?: RenderableConfig;
  state?: EntityStateConfig;
}

export interface EntityConfig {
  components: EntityComponentsConfig;
  id: EntityId;
  metadata?: EntityMetadataConfig;
}
