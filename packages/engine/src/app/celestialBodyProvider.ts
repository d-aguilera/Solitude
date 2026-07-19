import type { EntityId } from "../domain/domainPorts";
import type { Vec3 } from "../domain/vec3";

export const celestialBodyProviderCapability =
  "solitude.celestialBodyProvider.v1";

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
  const candidate = value as Partial<CelestialBodyProvider> | null;
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof candidate.getCelestialBody === "function"
  );
}
