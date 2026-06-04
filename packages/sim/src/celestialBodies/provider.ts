import type { Vec3 } from "@solitude/engine/math";
import type { EntityId } from "@solitude/engine/world";

export const celestialBodyProviderCapability = "celestialBodyProvider";

export interface CelestialBody {
  id: EntityId;
  mass: number;
  physicalRadius: number;
  position: Vec3;
  velocity: Vec3;
}

export interface CelestialBodyProvider {
  getCelestialBody: (id: EntityId) => CelestialBody | null;
}

export function isCelestialBodyProvider(
  value: unknown,
): value is CelestialBodyProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "getCelestialBody" in value &&
    typeof value.getCelestialBody === "function"
  );
}
