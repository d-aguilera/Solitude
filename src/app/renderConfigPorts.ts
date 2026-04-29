import type { Vec3 } from "../domain/vec3";
import type { MainViewLookState, Mesh, RGB } from "./scenePorts";

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
  mainViewCameraOffset?: Vec3;
  mainViewLookState?: MainViewLookState;
  /** @deprecated Use mainViewCameraOffset. */
  pilotCameraOffset?: Vec3;
  /** @deprecated Use mainViewLookState. */
  pilotLookState?: MainViewLookState;
}

export function getMainViewCameraOffset(config: WorldRenderConfig): Vec3 {
  const offset = config.mainViewCameraOffset ?? config.pilotCameraOffset;
  if (!offset) {
    throw new Error("Render config is missing mainViewCameraOffset");
  }
  return offset;
}

export function getMainViewLookState(
  config: WorldRenderConfig,
): MainViewLookState {
  const lookState = config.mainViewLookState ?? config.pilotLookState;
  if (!lookState) {
    throw new Error("Render config is missing mainViewLookState");
  }
  return lookState;
}
