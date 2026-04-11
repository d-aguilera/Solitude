import type { OrbitReadout } from "../domain/orbit";
import type { Vec3 } from "../domain/vec3";

export interface HudCell {
  row: number;
  col: number;
  text: string;
}

export interface HudRenderParams {
  currentThrustLevel: number;
  currentRcsLevel: number;
  currentTimeScale: number;
  fps: number;
  orbitReadout?: OrbitReadout | null;
  pilotCameraLocalOffset: Vec3;
  profilingEnabled: boolean;
  simTimeMillis: number; // accumulated simulation time.
  speedMps: number;
  hudCells: HudCell[];
}
