import type { Scene, WorldState, Vec3, BodyId } from "./types.js";
import { isPlanetSceneObject } from "./types.js";

export interface GravitatingBody {
  id: BodyId;
  mass: number;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Compute the mass of a planet (or star) based on its scene object.
 *
 * This keeps the density/physical-radius to mass mapping in one place,
 * decoupled from the higher-level body discovery logic in
 * getGravitatingBodies.
 */
function computePlanetMassFromScenePlanet(
  obj: ReturnType<typeof isPlanetSceneObject> extends true ? never : any
): number {
  // NOTE: TypeScript can't express "obj is PlanetSceneObject" here via the
  // return type of isPlanetSceneObject, so we lean on the runtime guard in
  // getGravitatingBodies. At call sites we only pass actual PlanetSceneObject.
  const anyObj = obj as unknown as { physicalRadius: number; density: number };
  const radius = anyObj.physicalRadius;
  const density = anyObj.density;
  const volume = (4 / 3) * Math.PI * radius * radius * radius;
  return density * volume;
}

/**
 * Construct the list of gravitating bodies (planes + planets) from the
 * current world/scene state. Mass for planets is derived from
 * physicalRadius and density on their scene objects; plane mass is a
 * gameplay constant.
 *
 * This keeps gravity-specific physical properties and discovery logic
 * in one place, decoupled from the core integrator.
 */
export function getGravitatingBodies(
  world: WorldState,
  scene: Scene,
  existingVelocitiesById: Map<BodyId, Vec3> | null
): GravitatingBody[] {
  const bodies: GravitatingBody[] = [];

  // 1) Planes: give them a plausible mass and take their position from world.
  const planeMass = 5e4; // gameplay-tuned mass for planes

  for (const plane of world.planes) {
    const velocity = existingVelocitiesById?.get(plane.id) ?? {
      x: 0,
      y: 0,
      z: 0,
    };

    bodies.push({
      id: plane.id,
      mass: planeMass,
      position: plane.position,
      velocity: { ...velocity },
    });
  }

  // 2) Planets: derive mass from density and physical radius.
  for (const obj of scene.objects) {
    if (!isPlanetSceneObject(obj)) continue;

    const mass = computePlanetMassFromScenePlanet(obj);

    // Use any existing velocity if present; otherwise, seed from world.planets.
    const existingV = existingVelocitiesById?.get(obj.id);
    let velocity: Vec3;
    if (existingV) {
      velocity = { ...existingV };
    } else {
      const body = world.planets.find((p) => p.id === obj.id);
      velocity = body ? { ...body.velocity } : { x: 0, y: 0, z: 0 };
    }

    const planetBody = world.planets.find((p) => p.id === obj.id);
    const position = planetBody ? planetBody.position : obj.position;

    bodies.push({
      id: obj.id,
      mass,
      position,
      velocity,
    });
  }

  return bodies;
}
