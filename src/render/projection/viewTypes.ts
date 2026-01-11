import type { ScreenPoint } from "../projection/projection.js";
import type {
  LocalFrame,
  Vec3,
  DrawMode,
  Scene,
  Plane,
} from "../../world/types.js";

export interface View {
  projection: (p: Vec3) => ScreenPoint | null;
  cameraPos: Vec3;
  cameraFrame: LocalFrame;
  drawMode: DrawMode;
  referencePlane: Plane;
  // Optional debug overlay, not part of scene geometry
  debugDraw?: (
    ctx: CanvasRenderingContext2D,
    scene: Scene,
    referencePlane: Plane
  ) => void;
}
