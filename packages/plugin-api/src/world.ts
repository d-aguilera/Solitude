import { vec3, type Vec3 } from "./math";
import type {
  ExternalEntityId,
  ExternalGravityMass,
  ExternalGravityPrimary,
  ExternalWorld,
} from "./plugin";

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
