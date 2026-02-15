import type {
  BodyState,
  GravityEngine,
  GravityState,
  ShipBody,
  Vec3,
  World,
} from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type {
  ControlledBodyState,
  GravityBodyBinding,
} from "./appInternals.js";
import { maxThrustAcceleration } from "./controls.js";

export function buildGravityBindings(world: World): GravityBodyBinding[] {
  const bindings: GravityBodyBinding[] = [];

  // Ships
  for (let i = 0; i < world.shipBodies.length; i++) {
    const ship = world.shipBodies[i];
    bindings.push({
      id: ship.id,
      kind: "ship",
      shipIndex: i,
      planetIndex: -1,
      starIndex: -1,
    });
  }

  // Planets
  for (let i = 0; i < world.planets.length; i++) {
    const planet = world.planets[i];
    bindings.push({
      id: planet.id,
      kind: "planet",
      shipIndex: -1,
      planetIndex: i,
      starIndex: -1,
    });
  }

  // Stars
  for (let i = 0; i < world.stars.length; i++) {
    const star = world.stars[i];
    bindings.push({
      id: star.id,
      kind: "star",
      shipIndex: -1,
      planetIndex: -1,
      starIndex: i,
    });
  }

  return bindings;
}

// Scratch vector for applyThrustToVelocity
const cvScratch = vec3.zero();

/**
 * Apply thrust acceleration to the controlled body's velocity when burn/brake
 * are active. Acceleration magnitude is:
 *
 *   a = maxThrustAcceleration * currentThrustPercent
 */
function applyThrustToVelocity(
  dtSeconds: number,
  currentThrustPercent: number,
  body: ControlledBodyState,
): void {
  if (dtSeconds === 0 || currentThrustPercent === 0) return;

  const { frame, velocity } = body;
  const accelMagnitude = maxThrustAcceleration * currentThrustPercent;
  vec3.scaleInto(cvScratch, accelMagnitude * dtSeconds, frame.forward);
  vec3.addInto(body.velocity, velocity, cvScratch);
}

function applyGravityPositionsToWorld(
  world: World,
  positions: Vec3[],
  gravityBindings: GravityBodyBinding[],
): void {
  const n = gravityBindings.length;
  if (positions.length !== n) {
    throw new Error(
      `applyGravityPositionsToWorld: position count ${positions.length} does not match bindings ${n}`,
    );
  }

  for (let i = 0; i < n; i++) {
    const binding = gravityBindings[i];
    const pos = positions[i];

    switch (binding.kind) {
      case "ship": {
        const ship = world.shipBodies[binding.shipIndex];
        vec3.copyInto(ship.position, pos);
        break;
      }
      case "planet": {
        const planet = world.planets[binding.planetIndex];
        vec3.copyInto(planet.position, pos);
        break;
      }
      case "star": {
        const star = world.stars[binding.starIndex];
        vec3.copyInto(star.position, pos);
        break;
      }
    }
  }
}

function syncShipVelocitiesFromGravity(
  world: World,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
): void {
  for (const binding of gravityBindings) {
    if (binding.kind !== "ship") continue;

    const bodyIndex = gravityState.bodies.findIndex((b) => b.id === binding.id);
    if (bodyIndex === -1) {
      continue;
    }

    const body = gravityState.bodies[bodyIndex];
    const ship = world.shipBodies[binding.shipIndex];

    ship.velocity = { ...body.velocity };
  }
}

/**
 * Applies thrust into the ship's body velocity
 */
export function applyThrust(
  dtSeconds: number,
  controlledShip: ShipBody,
  mainShipBodyState: BodyState,
  currentThrustPercent: number,
): void {
  if (dtSeconds === 0) {
    return;
  }

  const shipBodyState: ControlledBodyState = {
    frame: controlledShip.frame,
    velocity: mainShipBodyState.velocity,
  };

  applyThrustToVelocity(dtSeconds, currentThrustPercent, shipBodyState);

  mainShipBodyState.velocity = shipBodyState.velocity;
}

/**
 * Handles orbital physics:
 *  - Maintaining GravityState
 *  - Applying gravity and integrating positions
 */
export function applyGravity(
  dtSeconds: number,
  world: World,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
): void {
  if (dtSeconds === 0) {
    return;
  }

  // 1) Step gravity (updates velocities and positions).
  gravityEngine.step(dtSeconds, gravityState);

  // 2) Apply positions back into world via bindings.
  applyGravityPositionsToWorld(world, gravityState.positions, gravityBindings);

  // 3) Sync ship velocities in WorldState from gravityState so debug & HUD see them.
  syncShipVelocitiesFromGravity(world, gravityState, gravityBindings);
}
