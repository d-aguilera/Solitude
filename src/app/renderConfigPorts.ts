import type { Vec3 } from "../domain/vec3";
import type { Mesh, PilotLookState, RGB } from "./scenePorts";

export interface PlanetRenderConfig {
  id: string;
  kind: "planet";
  centralBodyId?: string;
  color: RGB;
  mesh: Mesh;
}

export interface StarRenderConfig {
  id: string;
  kind: "star";
  centralBodyId?: string;
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
