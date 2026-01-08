import type { BodyId, Camera, Plane, Vec3, WorldState } from "./types.js";

function getById<T extends { id: string }>(
  arr: T[],
  id: string,
  typeName: string
): T {
  const obj = arr.find((x) => x.id === id);
  if (!obj) throw new Error(`${typeName} not found: ${id}`);
  return obj;
}

export function getPlaneById(world: WorldState, id: string): Plane {
  return getById(world.planes, id, "Plane");
}

export function getCameraById(world: WorldState, id: string): Camera {
  return getById(world.cameras, id, "Camera");
}

// Optional: gravity-specific body <-> position/velocity
export function getBodyPosition(world: WorldState, id: BodyId): Vec3 {
  const plane = world.planes.find((p) => p.id === id);
  if (plane) return plane.position;

  const planet = world.planets.find((p) => p.id === id);
  if (planet) return planet.position;

  const star = world.stars.find((s) => s.id === id);
  if (star) return star.position;

  throw new Error(`Body position not found for id=${id}`);
}

export function setBodyPosition(
  world: WorldState,
  id: BodyId,
  pos: Vec3
): void {
  const plane = world.planes.find((p) => p.id === id);
  if (plane) {
    plane.position = pos;
    return;
  }

  const planet = world.planets.find((p) => p.id === id);
  if (planet) {
    planet.position = pos;
    return;
  }

  const star = world.stars.find((s) => s.id === id);
  if (star) {
    star.position = pos;
    return;
  }

  throw new Error(`Body position target not found for id=${id}`);
}
