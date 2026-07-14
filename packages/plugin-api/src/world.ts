import { vec3, type Vec3 } from "./math";

export type ExternalEntityId = string;

export interface ExternalEntityMotionState {
  id: ExternalEntityId;
  position: Vec3;
  velocity: Vec3;
}

export interface ExternalEntityCollisionSphere {
  id: ExternalEntityId;
  radius: number;
  state: ExternalEntityMotionState;
}

export interface ExternalGravityMass {
  id: ExternalEntityId;
  mass: number;
  state: ExternalEntityMotionState;
}

export interface ExternalLocalFrame {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

export interface ExternalControlledBody extends ExternalEntityMotionState {
  frame: ExternalLocalFrame;
}

export interface ExternalWorld {
  collisionSpheres: readonly ExternalEntityCollisionSphere[];
  controllableBodies: readonly ExternalControlledBody[];
  entityStates: readonly ExternalEntityMotionState[];
  gravityMasses: readonly ExternalGravityMass[];
}

export interface ExternalGravityPrimary {
  body: ExternalEntityMotionState;
  id: ExternalEntityId;
  mass: number;
  radius: number;
}

export interface ExternalFocusContext {
  controlledBody: ExternalControlledBody;
  entityId: ExternalEntityId;
}

export function getDominantBodyPrimary(
  world: ExternalWorld,
  position: Vec3,
): ExternalGravityPrimary | null {
  let best: ExternalGravityPrimary | null = null;
  let bestAccelerationFactor = Number.NEGATIVE_INFINITY;
  for (const sphere of world.collisionSpheres) {
    const gravityMass = findGravityMass(world.gravityMasses, sphere.id);
    if (!gravityMass) continue;
    const distanceSq = vec3.distSq(sphere.state.position, position);
    const accelerationFactor =
      distanceSq === 0 ? 0 : gravityMass.mass / distanceSq;
    if (accelerationFactor <= bestAccelerationFactor) continue;
    bestAccelerationFactor = accelerationFactor;
    best = {
      body: sphere.state,
      id: sphere.id,
      mass: gravityMass.mass,
      radius: sphere.radius,
    };
  }
  return best;
}

export function computeStandardGravitationalParameter(mass: number): number {
  return 6.6743e-11 * mass;
}

function findGravityMass(
  gravityMasses: readonly ExternalGravityMass[],
  id: ExternalEntityId,
): ExternalGravityMass | null {
  for (const gravityMass of gravityMasses) {
    if (gravityMass.id === id) return gravityMass;
  }
  return null;
}
