import type { DomainCameraPose } from "../app/appPorts";
import type { ShipBody } from "../domain/domainPorts";
import { localFrame } from "../domain/localFrame";
import { vec3, type Vec3 } from "../domain/vec3";
import { initialFrame } from "./setup";

export function createInitialTopCamera(ship: ShipBody): DomainCameraPose {
  const offset: Vec3 = vec3.create(0, 0, 50);
  const position = vec3.addInto(vec3.zero(), ship.position, offset);
  return {
    position,
    frame: localFrame.clone(initialFrame),
  };
}

export function createInitialPilotCamera(ship: ShipBody): DomainCameraPose {
  return {
    position: vec3.clone(ship.position), // will be offset in game loop
    frame: localFrame.clone(initialFrame),
  };
}
