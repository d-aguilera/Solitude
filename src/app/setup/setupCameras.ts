import type { ShipBody, Vec3 } from "../../domain/domainPorts.js";
import { localFrame } from "../../domain/localFrame.js";
import { vec3 } from "../../domain/vec3.js";
import type { DomainCameraPose } from "../appPorts.js";
import { initialFrame } from "./worldSetup.js";

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
