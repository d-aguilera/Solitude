import type { NdcPoint } from "../projection/projection.js";
import type { DrawMode, Scene } from "../../world/types.js";
import { LocalFrame, Vec3 } from "../../world/domain.js";

/**
 * Core configuration for rendering a scene from a particular viewpoint.
 *
 * Responsibilities:
 *  - Define how world-space points map to camera / NDC space (`projection`)
 *  - Specify the camera pose (`cameraPos`, `cameraFrame`)
 *  - Choose draw mode (`drawMode`)
 *
 * NOTE:
 *  This type is intentionally focused on pure rendering and camera-space math.
 *  Any debug overlays (velocity lines, labels, etc.) are configured separately
 *  via `ViewDebugOverlay` and invoked from the game loop.
 */
export interface View {
  /**
   * World-space -> NDC projection in the coordinate system
   * expected by the active renderer.
   *
   * Implementations return normalized device coordinates (x,y in [-1,1])
   * plus camera-space depth. Mapping to pixel coordinates is handled
   * by the rasterizer / overlay code based on the current canvas.
   */
  projection: (p: Vec3) => NdcPoint | null;
  cameraPos: Vec3;
  cameraFrame: LocalFrame;
  drawMode: DrawMode;
}

/**
 * Optional debug overlay hook for a view. Not part of scene geometry.
 *
 * NOTE:
 *  This is intentionally *decoupled* from the core `View`. Callers are
 *  responsible for threading any additional data they need (e.g. reference
 *  plane, chosen debug planes) into their overlay implementation rather than
 *  encoding that policy into the renderer.
 */
export interface ViewDebugOverlay {
  draw: (ctx: CanvasRenderingContext2D, scene: Scene) => void;
}
