import type { BodyId, StarPhysics, World } from "./domainPorts.js";

function getById<T extends { id: BodyId }>(
  arr: T[],
  id: string,
  typeName: string,
): T {
  const obj = arr.find((x) => x.id === id);
  if (!obj) throw new Error(`${typeName} not found: ${id}`);
  return obj;
}

export function getStarPhysicsById(world: World, id: BodyId): StarPhysics {
  return getById(world.starPhysics, id, "StarPhysics");
}
