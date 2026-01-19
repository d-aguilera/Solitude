import type {
  BodyId,
  DomainCameraPose,
  DomainWorld,
  ShipBody,
  StarPhysics,
} from "./domainPorts.js";

function getById<T extends { id: BodyId }>(
  arr: T[],
  id: string,
  typeName: string,
): T {
  const obj = arr.find((x) => x.id === id);
  if (!obj) throw new Error(`${typeName} not found: ${id}`);
  return obj;
}

export function getDomainCameraById(
  world: DomainWorld,
  id: BodyId,
): DomainCameraPose {
  return getById(world.cameras, id, "Camera");
}

export function getShipBodyById(world: DomainWorld, id: BodyId): ShipBody {
  return getById(world.shipBodies, id, "ShipBody");
}

export function getStarPhysicsById(
  world: DomainWorld,
  id: BodyId,
): StarPhysics {
  return getById(world.starPhysics, id, "StarPhysics");
}
