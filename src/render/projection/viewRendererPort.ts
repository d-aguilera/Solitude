import type {
  DrawMode,
  Plane,
  Profiler,
  Scene,
  Vec3,
  WorldState,
} from "../../world/types.js";

/**
 * Thin abstraction over how individual views (pilot, top‑down, etc.)
 * are rendered from world/scene state.
 *
 * This interface is intended for use inside the rendering layer itself.
 * Higher‑level app/game code should depend only on the top‑level Renderer
 * port and not traffic ViewRenderer instances directly.
 */
export interface ViewRenderer {
  renderPilotView(params: {
    scene: Scene;
    world: WorldState;
    pilotCameraId: string;
    referencePlane: Plane;
    drawMode: DrawMode;
    debugPlanes: Plane[];
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
  }): void;

  renderTopView(params: {
    scene: Scene;
    world: WorldState;
    topCameraId: string;
    referencePlane: Plane;
    drawMode: DrawMode;
    debugPlanes: Plane[];
    profiler: Profiler;
  }): void;
}
