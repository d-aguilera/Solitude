import { Profiler, Vec3 } from "../world/domain.js";
import type { Plane, Scene, WorldState } from "../world/types.js";
import type { ViewConfig } from "./viewConfig.js";

/**
 * Top‑level rendering abstraction for the app layer.
 */
export interface Renderer {
  renderFrame(params: {
    scene: Scene;
    world: WorldState;
    mainPlane: Plane;
    pilotView: ViewConfig;
    topView: ViewConfig;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
    profilingEnabled: boolean;
  }): void;
}
