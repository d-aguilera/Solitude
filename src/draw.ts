import { DRAW_MODE, HEIGHT, WIDTH } from "./config.js";
import type { ScreenPoint } from "./projection.js";
import { toRenderable } from "./renderPrep.js";
import { buildShadedFaces } from "./shadedFaces.js";
import type { Profiler, SceneObject, Vec3, View } from "./types.js";
import {
  renderShadedFacesToCanvas,
  strokePolylineOnCanvas,
} from "./canvasRasterizer.js";

interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lightDir: Vec3;
  profiler: Profiler;
}

/**
 * Clears the entire canvas for a new frame.
 */
export function clear(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#000000";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

/**
 * Orchestrate rasterization of all scene objects for a given view.
 *
 * Responsibilities kept here:
 *  - Choosing between face-shaded vs. line (wireframe) draw modes
 *  - Delegating to shaded-face builder for lighting/culling/projection
 *  - Building projected polylines / face lists
 */
export function draw(
  context: CanvasRenderingContext2D,
  { objects, view, lightDir, profiler }: DrawOptions
): void {
  const { projection, cameraPos } = view;
  const projectedPoints: ScreenPoint[] = [];

  profiler.run("DRAW", "total", () => {
    if (DRAW_MODE === "faces") {
      profiler.run("DRAW", "faces", () => {
        // 1) Solid objects: faces path, skipping wireframe-only
        const faceList = buildShadedFaces({
          objects,
          projection,
          cameraPos,
          lightDir,
        });

        // Depth sort & draw faces via rasterizer
        renderShadedFacesToCanvas(context, faceList);
      });

      // 2) Wireframe-only objects: lines path
      profiler.run("DRAW", "wireframeOnly", () => {
        objects.forEach((obj) => {
          if (!obj.wireframeOnly) {
            return;
          }

          const { mesh, worldPoints, color, lineWidth } = toRenderable(obj);
          const { faces } = mesh;

          for (let i = 0; i < faces.length; i++) {
            const polyIndices = faces[i];
            projectedPoints.length = 0;
            for (let j = 0; j < polyIndices.length; j++) {
              const p = projection(worldPoints[polyIndices[j]]);
              if (!p) {
                projectedPoints.length = 0;
                break;
              }
              projectedPoints.push(p);
            }
            if (projectedPoints.length > 0) {
              strokePolylineOnCanvas(
                context,
                projectedPoints,
                color,
                lineWidth
              );
            }
          }
        });
      });
    } else {
      // Pure wireframe mode: draw all objects as polylines
      objects.forEach((obj) => {
        const { mesh, worldPoints, color, lineWidth } = toRenderable(obj);
        const { faces } = mesh;

        profiler.run("DRAW", "lines", () => {
          for (let i = 0; i < faces.length; i++) {
            const polyIndices = faces[i];
            projectedPoints.length = 0;
            for (let j = 0; j < polyIndices.length; j++) {
              const p = projection(worldPoints[polyIndices[j]]);
              if (!p) {
                projectedPoints.length = 0;
                break;
              }
              projectedPoints.push(p);
            }
            if (projectedPoints.length > 0) {
              strokePolylineOnCanvas(
                context,
                projectedPoints,
                color,
                lineWidth
              );
            }
          }
        });
      });
    }
  });
}
