import type { LocalFrame, Vec3 } from "../../domain/domainPorts.js";
import type { NdcPoint } from "./NdcPoint.js";
import type { DrawMode } from "./ViewDebugOverlay.js";

/**
 * Core configuration for rendering a scene from a particular viewpoint.
 */
export interface View {
  projection: (p: Vec3) => NdcPoint | null;
  cameraPos: Vec3;
  cameraFrame: LocalFrame;
  drawMode: DrawMode;
}
