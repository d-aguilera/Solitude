import type { LocalFrame, Mat3, Vec3 } from "@solitude/engine/math";
import type { RGB } from "@solitude/engine/render";
import type {
  AngularVelocity,
  EntityConfig,
  EntityId,
} from "@solitude/engine/world";

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
    color: RGB;
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
