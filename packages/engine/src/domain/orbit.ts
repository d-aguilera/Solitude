import { parameters } from "../global/parameters";
import type { EntityId, EntityMotionState, World } from "./domainPorts";
import { type Vec3, vec3 } from "./vec3";

export type GravityPrimary = {
  id: EntityId;
  body: EntityMotionState;
  mass: number;
  radius: number;
};

export function getDominantBody(
  world: World,
  position: Vec3,
): EntityMotionState | null {
  const primary = getDominantBodyPrimary(world, position);
  return primary ? primary.body : null;
}

export function getDominantBodyPrimary(
  world: World,
  position: Vec3,
): GravityPrimary | null {
  return findDominantBody(world, position);
}

function findDominantBody(world: World, position: Vec3): GravityPrimary | null {
  let best: GravityPrimary | null = null;
  let bestAccel = -Infinity;

  for (let i = 0; i < world.collisionSpheres.length; i++) {
    const sphere = world.collisionSpheres[i];
    const mass = findGravityMass(world, sphere.id);
    if (mass == null) continue;

    const accel = accelMagnitudeAtPosition(sphere.state, mass, position);
    if (accel > bestAccel) {
      bestAccel = accel;
      best = {
        id: sphere.id,
        body: sphere.state,
        mass,
        radius: sphere.radius,
      };
    }
  }

  return best;
}

function accelMagnitudeAtPosition(
  body: EntityMotionState,
  mass: number,
  position: Vec3,
): number {
  const r2 = vec3.distSq(body.position, position);
  if (r2 === 0) return 0;
  return (parameters.newtonG * mass) / r2;
}

function findGravityMass(world: World, id: EntityId): number | null {
  for (let i = 0; i < world.gravityMasses.length; i++) {
    const mass = world.gravityMasses[i];
    if (mass.id === id) return mass.mass;
  }
  return null;
}
