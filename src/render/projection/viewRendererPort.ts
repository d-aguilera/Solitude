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
 * Implementations can choose any rendering backend (Canvas2D, WebGL, etc.)
 * and are responsible for:
 *   - Choosing concrete cameras / projection parameters
 *   - Issuing draw calls into their rendering backend
 *   - Rendering any per‑view debug overlays
 *
 * This interface is deliberately separate from higher‑level game orchestration
 * and world/physics logic.
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
