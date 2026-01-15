import { CameraPose } from "./domain.js";
import type { Plane, WorldState } from "./types.js";

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

export function getCameraById(world: WorldState, id: string): CameraPose {
  return getById(world.cameras, id, "Camera");
}
