import type { Profiler, Vec3 } from "../world/domain.js";
import type { Plane, WorldState } from "../world/types.js";

/**
 * Top‑level rendering abstraction for the app layer.
 *
 * This interface intentionally does not depend on Scene or any
 * view‑composition types. The app is responsible for mapping
 * world state into whatever view configuration is needed before
 * calling into a concrete renderer.
 */
export interface Renderer {
  renderFrame(params: {
    world: WorldState;
    mainPlane: Plane;
    pilotContext: CanvasRenderingContext2D;
    topContext: CanvasRenderingContext2D;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
    profilingEnabled: boolean;
  }): void;
}
