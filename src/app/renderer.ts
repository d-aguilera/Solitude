import type {
  DrawMode,
  Plane,
  Profiler,
  Scene,
  Vec3,
  WorldState,
} from "../world/types.js";
import type { ViewRenderer } from "../render/projection/viewRendererPort.js";

/**
 * Thin abstraction over the rendering pipeline.
 *
 * This keeps the game loop unaware of any specific UI technology
 * (canvas, WebGL, etc.) and lets an adapter translate these calls
 * into concrete draw operations.
 *
 * Implementations compose a lower‑level ViewRenderer that owns the
 * details of how individual views (pilot, top‑down, etc.) are drawn.
 */
export interface Renderer {
  /**
   * Render all visual outputs for the current frame.
   *
   * Implementations are responsible for:
   *  - Delegating to a ViewRenderer for per‑view drawing
   *  - Issuing draw calls into their rendering backend
   *  - Rendering any HUD / overlays
   */
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
    viewRenderer: ViewRenderer;
  }): void;
}
