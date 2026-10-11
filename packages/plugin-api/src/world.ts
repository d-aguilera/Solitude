import { vec3, type Mat3, type Vec3 } from "./math";

export type ExternalEntityId = string;

export interface ExternalAngularVelocity {
  pitch: number;
  roll: number;
  yaw: number;
}

export interface ExternalEntityMotionState {
  angularVelocity?: ExternalAngularVelocity;
  frame?: ExternalLocalFrame;
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
  angularVelocity: ExternalAngularVelocity;
  frame: ExternalLocalFrame;
  orientation?: Mat3;
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
  const firstSphere = world.collisionSpheres[0];
  if (!firstSphere) return null;
  const out: ExternalGravityPrimary = {
    body: firstSphere.state,
    id: "",
    mass: 0,
    radius: 0,
  };
  return getDominantBodyPrimaryInto(out, world, position) ? out : null;
}

/** Writes the selected primary without allocating a lookup result. */
export function getDominantBodyPrimaryInto(
  out: ExternalGravityPrimary,
  world: ExternalWorld,
  position: Vec3,
): boolean {
  let found = false;
  let bestAccelerationFactor = Number.NEGATIVE_INFINITY;
  for (const sphere of world.collisionSpheres) {
    const gravityMass = findGravityMass(world.gravityMasses, sphere.id);
    if (!gravityMass) continue;
    const distanceSq = vec3.distSq(sphere.state.position, position);
    const accelerationFactor =
      distanceSq === 0 ? 0 : gravityMass.mass / distanceSq;
    if (!(accelerationFactor > bestAccelerationFactor)) continue;
    bestAccelerationFactor = accelerationFactor;
    out.body = sphere.state;
    out.id = sphere.id;
    out.mass = gravityMass.mass;
    out.radius = sphere.radius;
    found = true;
  }
  return found;
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
