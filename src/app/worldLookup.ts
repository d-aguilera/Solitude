import type { BodyId } from "../domain/domainPorts.js";
import type { Plane, WorldState } from "./worldState.js";

function getById<T extends { id: BodyId }>(
  arr: T[],
  id: string,
  typeName: string,
): T {
  const obj = arr.find((x) => x.id === id);
  if (!obj) throw new Error(`${typeName} not found: ${id}`);
  return obj;
}

export function getPlaneById(world: WorldState, id: BodyId): Plane {
  return getById(world.planes, id, "Plane");
}
