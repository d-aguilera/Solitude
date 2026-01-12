import type {
  DrawMode,
  Plane,
  Profiler,
  Scene,
  Vec3,
  WorldState,
} from "../world/types.js";

/**
 * Top‑level rendering abstraction for the app layer.
 *
 * The game loop depends only on this interface and remains unaware of:
 *  - Any specific rendering API (Canvas2D, WebGL, etc.)
 *  - Any per‑view configuration or projection details
 */
export interface Renderer {
  renderFrame(params: {
    scene: Scene;
    world: WorldState;
    mainPlane: Plane;
    mainPlaneId: string;
    topCameraId: string;
    pilotCameraId: string;
    debugPlanes: Plane[];
    drawMode: DrawMode;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
  }): void;
}
