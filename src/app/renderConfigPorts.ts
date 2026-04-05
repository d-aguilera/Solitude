import type { Vec3 } from "../domain/vec3";
import type { Mesh, PilotLookState, RGB } from "./scenePorts";

export interface PlanetRenderConfig {
  id: string;
  kind: "planet";
  pathId?: string; // orbit path id, purely logical association
  color: RGB;
  mesh: Mesh;
}

export interface StarRenderConfig {
  id: string;
  kind: "star";
  color: RGB;
  mesh: Mesh;
}

export interface ShipRenderConfig {
  id: string;
  color: RGB;
  mesh: Mesh;
}

export interface WorldRenderConfig {
  pilotCameraOffset: Vec3;
  pilotLookState: PilotLookState;
  topCameraOffset: Vec3;
  planets: (PlanetRenderConfig | StarRenderConfig)[];
  ships: ShipRenderConfig[];
}
