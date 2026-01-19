import type {
  BodyState,
  DomainWorld,
  GravityBodyBinding,
  GravityState,
} from "./domainPorts";

/**
 * Create a brand-new GravityState from the current world contents.
 * Call this once at setup time, or if entities are added/removed.
 */
export function buildInitialGravityState(world: DomainWorld): GravityState {
  const bindings = buildGravityBindings(world);
  const bodies: BodyState[] = [];

  const shipMass = 5e4;

  // Ships
  for (let i = 0; i < world.shipBodies.length; i++) {
    const ship = world.shipBodies[i];
    bodies.push({
      id: ship.id,
      mass: shipMass,
      velocity: { ...ship.velocity },
    });
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
  }

  return { bodies, bindings };
}

function buildGravityBindings(world: DomainWorld): GravityBodyBinding[] {
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
