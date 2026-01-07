import type { ScreenPoint } from "./projection.js";
import type { Vec3, DrawMode } from "./types.js";

export interface View {
  projection: (p: Vec3) => ScreenPoint | null;
  cameraPos: Vec3 | null;
  drawMode: DrawMode;
  // Optional debug overlay, not part of scene geometry
  debugDraw?: (ctx: CanvasRenderingContext2D) => void;
}
