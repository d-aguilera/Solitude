import type { AppWorld, Ship } from "./appInternals.js";
import type { BodyId } from "../domain/domainPorts.js";

function getById<T extends { id: BodyId }>(
  arr: T[],
  id: string,
  typeName: string,
): T {
  const obj = arr.find((x) => x.id === id);
  if (!obj) throw new Error(`${typeName} not found: ${id}`);
  return obj;
}

export function getShipById(world: AppWorld, id: BodyId): Ship {
  return getById(world.shipBodies, id, "Ship");
}
