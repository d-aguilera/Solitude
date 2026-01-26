import type {
  World,
  GravityState,
  BodyState,
  Vec3,
  GravityEngine,
  ShipBody,
} from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type { ControlState, ControlledBodyState } from "./appInternals.js";
import type { ControlInput, GravityBodyBinding } from "./appPorts.js";
import { getSignedThrustPercent, maxThrustAcceleration } from "./controls.js";

/**
 * Create a brand-new GravityState from the current world contents.
 */
export function buildInitialGravityState(world: World): GravityState {
  const bodies: BodyState[] = [];
  const positions: Vec3[] = [];

  const shipMass = 5e4;

  // Ships
  for (let i = 0; i < world.shipBodies.length; i++) {
    const ship = world.shipBodies[i];
    bodies.push({
      id: ship.id,
      mass: shipMass,
      velocity: { ...ship.velocity },
    });
    positions.push({ ...ship.position });
  }

  // Planets
  for (let i = 0; i < world.planets.length; i++) {
    const body = world.planets[i];
    const physics = world.planetPhysics.find((p) => p.id === body.id);
    if (!physics) continue;

    bodies.push({
      id: body.id,
      mass: physics.mass,
      velocity: { ...body.velocity },
    });
    positions.push({ ...body.position });
  }

  // Stars
  for (let i = 0; i < world.stars.length; i++) {
    const body = world.stars[i];
    const physics = world.starPhysics.find((p) => p.id === body.id);
    if (!physics) continue;

    bodies.push({
      id: body.id,
      mass: physics.mass,
      velocity: { ...body.velocity },
    });
    positions.push({ ...body.position });
  }

  return { bodies, positions };
}

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

/**
 * Apply thrust acceleration to the controlled body's velocity when burn/brake
 * are active. Acceleration magnitude is:
 *
 *   a = maxThrustAcceleration * thrustPercent
 *
 * where thrustPercent ∈ [-1, 1] and is chosen from discrete levels
 * depending on Space/B and numeric thrust keys.
 */
export function applyThrustToVelocity(
  dtSeconds: number,
  input: ControlInput,
  controlState: ControlState,
  body: ControlledBodyState,
): void {
  if (dtSeconds <= 0) return;

  const thrustPercent = getSignedThrustPercent(input, controlState);
  if (thrustPercent === 0) return;

  const { frame, velocity } = body;
  const accelMagnitude = maxThrustAcceleration * thrustPercent;
  const dv = vec3.scale(frame.forward, accelMagnitude * dtSeconds);

  vec3.addInto(body.velocity, velocity, dv);
}

export function applyGravityPositionsToWorld(
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
        ship.position = { ...pos };
        break;
      }
      case "planet": {
        const planet = world.planets[binding.planetIndex];
        planet.position = { ...pos };
        break;
      }
      case "star": {
        const star = world.stars[binding.starIndex];
        star.position = { ...pos };
        break;
      }
    }
  }
}

export function syncShipVelocitiesFromGravity(
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
 * Handles forces and orbital physics:
 *  - Maintaining GravityState
 *  - Applying thrust into the ship's body velocity
 *  - Applying gravity and integrating positions
 */
export function integrateForcesAndGravity(
  dtSeconds: number,
  world: World,
  controlledShip: ShipBody,
  mainShipBodyIndex: number,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
  input: ControlInput,
  controlState: ControlState,
): void {
  const gravityTimeScale = 10;
  const gravityDt = dtSeconds * gravityTimeScale;

  if (gravityDt === 0) {
    return;
  }

  // 1) Apply thrust to the main ship's body velocity inside gravityState.
  const shipBodyState = gravityState.bodies[mainShipBodyIndex];

  const bodyState: ControlledBodyState = {
    frame: controlledShip.frame,
    velocity: shipBodyState.velocity,
  };

  applyThrustToVelocity(gravityDt, input, controlState, bodyState);

  shipBodyState.velocity = bodyState.velocity;

  // 2) Step gravity (updates velocities and positions).
  gravityEngine.step(gravityDt, gravityState);

  // 3) Apply positions back into AppWorld via bindings.
  applyGravityPositionsToWorld(world, gravityState.positions, gravityBindings);

  // 4) Sync ship velocities in WorldState from gravityState so debug & HUD see them.
  syncShipVelocitiesFromGravity(world, gravityState, gravityBindings);
}
