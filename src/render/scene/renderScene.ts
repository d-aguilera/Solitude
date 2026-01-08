import {
  renderShadedFaces,
  renderPolyline,
} from "../canvas/canvasRasterizer.js";
import type { ScreenPoint } from "../projection/projection.js";
import { toRenderable } from "./renderPrep.js";
import { buildShadedFaces } from "./shadedFaces.js";
import type { Profiler, SceneObject, Vec3 } from "../../world/types.js";
import type { View } from "../projection/viewTypes.js";

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
  const { width, height } = context.canvas;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
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

  profiler.run("DRAW", "total", () => {
    if (view.drawMode === "faces") {
      profiler.run("DRAW", "faces", () => {
        // 1) Solid objects: faces path, skipping wireframe-only
        const faceList = buildShadedFaces({
          objects,
          projection,
          cameraPos,
          lightDir,
        });

        // Depth sort & draw faces via rasterizer
        renderShadedFaces(context, faceList);
      });

      // 2) Wireframe-only objects: lines path
      profiler.run("DRAW", "wireframeOnly", () => {
        drawMeshPolylines(
          context,
          objects.filter((obj) => obj.wireframeOnly),
          projection
        );
      });
    } else {
      // Pure wireframe mode: draw all objects as polylines
      profiler.run("DRAW", "lines", () => {
        drawMeshPolylines(context, objects, projection);
      });
    }
  });
}

function drawMeshPolylines(
  context: CanvasRenderingContext2D,
  objects: SceneObject[],
  projection: (p: Vec3) => ScreenPoint | null
): void {
  const projectedPoints: ScreenPoint[] = [];

  objects.forEach((obj) => {
    const { mesh, worldPoints, baseColor, lineWidth } = toRenderable(obj);
    const { faces } = mesh;

    for (let i = 0; i < faces.length; i++) {
      const polyIndices = faces[i];

      for (let j = 0; j < polyIndices.length; j++) {
        const p = projection(worldPoints[polyIndices[j]]);
        if (p) {
          projectedPoints.push(p);
        } else {
          projectedPoints.length = 0;
          break;
        }
      }

      if (projectedPoints.length > 0) {
        renderPolyline(context, projectedPoints, baseColor, lineWidth);
        projectedPoints.length = 0;
      }
    }
  });
}
