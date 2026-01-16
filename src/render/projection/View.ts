import type { LocalFrame, Vec3 } from "../../domain/domainPorts.js";
import type { NdcPoint } from "./NdcPoint.js";
import type { DrawMode } from "./ViewDebugOverlay.js";

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
