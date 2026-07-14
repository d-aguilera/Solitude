import type { AngularVelocity, EntityId } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Mat3 } from "../domain/mat3";
import type { Vec3 } from "../domain/vec3";
import type { EntityConfig } from "./entityConfigPorts";

export const controllableEntityProviderCapability =
  "controllableEntityProvider";

export interface DirectControllableEntityPlacement {
  angularVelocity: AngularVelocity;
  frame: LocalFrame;
  orientation: Mat3;
  position: Vec3;
  velocity: Vec3;
}

export interface ControllableEntityProvider {
  id: string;
  mass: number;
  createEntity: (params: {
    color: { r: number; g: number; b: number };
    id: EntityId;
    placement: DirectControllableEntityPlacement;
  }) => EntityConfig;
}

export function isControllableEntityProvider(
  value: unknown,
): value is ControllableEntityProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "mass" in value &&
    typeof value.mass === "number" &&
    "createEntity" in value &&
    typeof value.createEntity === "function"
  );
}
