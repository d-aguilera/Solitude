import type { World } from "./domainPorts";
import { type Vec3, vec3 } from "./vec3";

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
 * Process collisions between controllable bodies and collision spheres.
 *
 * Behavior:
 *  - Controllable bodies are treated as points.
 *  - Collision bodies are treated as rigid spheres.
 *  - Collisions are resolved in the body's rest frame:
 *      v_rel  = v_controlled - v_body
 *      v_rel' = v_rel - 2 * (v_rel · n) * n
 *      v_controlled' = v_body + v_rel'
 *    where n is the outward normal from body center to controlled body.
 */
export function resolveCollisions(world: World): void {
  const { collisionSpheres, controllableBodies } = world;

  const sphereCount = collisionSpheres.length;

  for (let si = 0; si < controllableBodies.length; si++) {
    const controlledBody = controllableBodies[si];
    const controlledPosition = controlledBody.position;
    const controlledVelocity = controlledBody.velocity;

    let collided = false;
    let bestPenetration = 0;
    let bestCenter: Vec3 | null = null;
    let bestVelocity: Vec3 | null = null;
    let bestRadius = 0;

    for (let i = 0; i < sphereCount; i++) {
      const sphere = collisionSpheres[i];
      if (sphere.id === controlledBody.id) continue;

      const body = sphere.state;
      const radius = sphere.radius;

      // delta = controlledPosition - body.position
      vec3.subInto(deltaScratch, controlledPosition, body.position);
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

    // Resolve the single deepest collision for this controlled body.

    // normal = (controlledPosition - bestCenter) normalized
    vec3.subInto(normalScratch, controlledPosition, bestCenter);
    vec3.normalizeInto(normalScratch);

    // Place controlled body exactly on the surface.
    vec3.scaledAddInto(
      controlledPosition,
      bestCenter,
      normalScratch,
      bestRadius,
    );

    // Relative velocity in the body's rest frame.
    vec3.subInto(vRelScratch, controlledVelocity, bestVelocity);

    // Project relative velocity onto normal: vn = v_rel · n
    const vn = vec3.dot(vRelScratch, normalScratch);

    // If the controlled body is moving away from the surface, keep velocity.
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

    // Back to world frame.
    vec3.addInto(controlledVelocity, bestVelocity, vRelScratch);
  }
}
