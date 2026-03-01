import type { World } from "./domainPorts.js";
import { type Vec3, vec3 } from "./vec3.js";

// Tunable bounce factor (0 = no bounce, 1 = perfectly elastic).
const restitution = 0.2;

// Damp residual tangential velocity to "settle" faster.
const tangentialDamping = 0.1; // 0..1

// Scratch vectors reused across calls to avoid allocations.
const deltaScratch: Vec3 = vec3.zero();
const normalScratch: Vec3 = vec3.zero();
const vRelScratch: Vec3 = vec3.zero();
const vNormalScratch: Vec3 = vec3.zero();

/**
 * Process collisions between ship bodies and planets/stars.
 *
 * Behavior:
 *  - Ships are treated as points.
 *  - Planets and stars are treated as rigid spheres with physicalRadius.
 *  - Collisions are resolved in the body's rest frame:
 *      v_rel  = v_ship - v_body
 *      v_rel' = v_rel - 2 * (v_rel · n) * n
 *      v_ship' = v_body + v_rel'
 *    where n is the outward normal from body center to ship.
 */
export function resolveCollisions(world: World): void {
  const { shipBodies, planets, planetPhysics, stars, starPhysics } = world;

  const nPlanets = planets.length;
  const nStars = stars.length;

  for (let si = 0; si < shipBodies.length; si++) {
    const ship = shipBodies[si];
    const shipPos = ship.position;
    const shipVel = ship.velocity;

    let collided = false;
    let bestPenetration = 0;
    let bestCenter: Vec3 | null = null;
    let bestVelocity: Vec3 | null = null;
    let bestRadius = 0;

    // Check against planets (index-aligned with planetPhysics).
    for (let i = 0; i < nPlanets; i++) {
      const body = planets[i];
      const phys = planetPhysics[i];
      if (!phys) continue;

      const radius = phys.physicalRadius;

      // delta = shipPos - body.position
      vec3.subInto(deltaScratch, shipPos, body.position);
      const distSq = vec3.lengthSq(deltaScratch);
      const radiusSq = radius * radius;

      if (distSq >= radiusSq) continue;

      const dist = Math.sqrt(distSq);
      const penetration = radius - dist;

      if (!collided || penetration > bestPenetration) {
        collided = true;
        bestPenetration = penetration;
        bestCenter = body.position;
        bestVelocity = body.velocity;
        bestRadius = radius;
      }
    }

    // Check against stars (index-aligned with starPhysics).
    for (let i = 0; i < nStars; i++) {
      const body = stars[i];
      const phys = starPhysics[i];
      if (!phys) continue;

      const radius = phys.physicalRadius;

      // delta = shipPos - body.position
      vec3.subInto(deltaScratch, shipPos, body.position);
      const distSq = vec3.lengthSq(deltaScratch);
      const radiusSq = radius * radius;

      if (distSq >= radiusSq) continue;

      const dist = Math.sqrt(distSq);
      const penetration = radius - dist;

      if (!collided || penetration > bestPenetration) {
        collided = true;
        bestPenetration = penetration;
        bestCenter = body.position;
        bestVelocity = body.velocity;
        bestRadius = radius;
      }
    }

    if (!collided || !bestCenter || !bestVelocity) continue;

    // Resolve the single deepest collision for this ship.

    // normal = (shipPos - bestCenter) normalized
    vec3.subInto(normalScratch, shipPos, bestCenter);
    vec3.normalizeInto(normalScratch);

    // Place ship exactly on the surface: shipPos = bestCenter + normal * bestRadius
    vec3.scaledAddInto(shipPos, bestCenter, normalScratch, bestRadius);

    // Relative velocity in the body's rest frame: v_rel = v_ship - v_body
    vec3.subInto(vRelScratch, shipVel, bestVelocity);

    // Project relative velocity onto normal: vn = v_rel · n
    const vn = vec3.dot(vRelScratch, normalScratch);

    // If the ship is moving away from the surface in the body's frame, keep velocity.
    if (vn >= 0) {
      continue;
    }

    // v_normal = vn * n
    vec3.scaleInto(vNormalScratch, vn, normalScratch);

    // Inelastic reflection in body's frame:
    // v_rel' = v_rel - (1 + e) * v_normal, where e in [0, 1]
    vec3.scaleInto(vNormalScratch, 1 + restitution, vNormalScratch);
    vec3.subInto(vRelScratch, vRelScratch, vNormalScratch);

    vec3.scaleInto(vRelScratch, 1 - tangentialDamping, vRelScratch);

    // Back to world frame: v_ship' = v_body + v_rel'
    vec3.addInto(shipVel, bestVelocity, vRelScratch);
  }
}
