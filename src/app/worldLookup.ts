import type { BodyId, ShipBody, World } from "../domain/domainPorts.js";

function getById<T extends { id: BodyId }>(
  arr: T[],
  id: string,
  typeName: string,
): T {
  const obj = arr.find((x) => x.id === id);
  if (!obj) throw new Error(`${typeName} not found: ${id}`);
  return obj;
}

export function getShipById(world: World, id: BodyId): ShipBody {
  return getById(world.shipBodies, id, "Ship");
}
