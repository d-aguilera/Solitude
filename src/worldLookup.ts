import type { BodyId, Camera, Plane, Vec3, WorldState } from "./types.js";

export function getPlaneById(world: WorldState, id: string): Plane {
  const plane = world.planes.find((p) => p.id === id);
  if (!plane) throw new Error(`Plane not found: ${id}`);
  return plane;
}

export function getCameraById(world: WorldState, id: string): Camera {
  const camera = world.cameras.find((c) => c.id === id);
  if (!camera) throw new Error(`Camera not found: ${id}`);
  return camera;
}

// Optional: gravity-specific body <-> position/velocity
export function getBodyPosition(world: WorldState, id: BodyId): Vec3 {
  const plane = world.planes.find((p) => p.id === id);
  if (plane) return plane.position;

  const planet = world.planets.find((p) => p.id === id);
  if (planet) return planet.position;

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

  throw new Error(`Body position target not found for id=${id}`);
}
