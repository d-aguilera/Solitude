import {
  renderShadedFaces,
  renderPolyline,
} from "../canvas/canvasRasterizer.js";
import type { ScreenPoint } from "../projection/projection.js";
import { projectCameraPoint } from "../projection/projection.js";
import { toRenderable } from "./renderPrep.js";
import { buildShadedFaces, getCameraPointsForObject } from "./shadedFaces.js";
import type {
  PointLight,
  Profiler,
  SceneObject,
  Vec3,
} from "../../world/types.js";
import type { View } from "../projection/viewTypes.js";

interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lights: PointLight[];
  profiler: Profiler;
  frameId: number;
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
  { objects, view, lights, profiler, frameId }: DrawOptions
): void {
  const { cameraPos, cameraFrame } = view;
  const { width, height } = context.canvas;

  profiler.run("DRAW", "total", () => {
    if (view.drawMode === "faces") {
      profiler.run("DRAW", "faces", () => {
        // 1) Solid objects: faces path, skipping wireframe-only
        const faceList = buildShadedFaces({
          objects,
          cameraPos,
          cameraFrame,
          canvasWidth: width,
          canvasHeight: height,
          lights,
          frameId,
        });

        // Depth sort & draw faces via rasterizer
        renderShadedFaces(context, faceList);
      });

      // 2) Wireframe-only objects: lines path
      profiler.run("DRAW", "wireframeOnly", () => {
        drawMeshPolylinesCameraSpace(
          context,
          objects.filter((obj) => obj.wireframeOnly),
          cameraPos,
          cameraFrame,
          width,
          height,
          frameId
        );
      });
    } else {
      // Pure wireframe mode: draw all objects as polylines using camera-space cache
      profiler.run("DRAW", "lines", () => {
        drawMeshPolylinesCameraSpace(
          context,
          objects,
          cameraPos,
          cameraFrame,
          width,
          height,
          frameId
        );
      });
    }
  });
}

function drawMeshPolylinesCameraSpace(
  context: CanvasRenderingContext2D,
  objects: SceneObject[],
  cameraPos: Vec3,
  cameraFrame: import("../../world/types.js").LocalFrame,
  canvasWidth: number,
  canvasHeight: number,
  frameId: number
): void {
  const projectedPoints: ScreenPoint[] = [];

  objects.forEach((obj) => {
    const { mesh, worldPoints, baseColor, lineWidth } = toRenderable(obj);
    const { faces } = mesh;

    // Get (or build) camera-space vertices for this object and frame
    const cameraPoints = getCameraPointsForObject(
      obj,
      worldPoints,
      cameraPos,
      cameraFrame,
      frameId
    );

    for (let i = 0; i < faces.length; i++) {
      const polyIndices = faces[i];
      projectedPoints.length = 0;

      for (let j = 0; j < polyIndices.length; j++) {
        const idx = polyIndices[j];
        const cp = cameraPoints[idx];

        // Skip points behind near plane (consistent with makeTopView/makePilotView)
        if (cp.y < 0.01) {
          projectedPoints.length = 0;
          break;
        }

        const sp = projectCameraPoint(cp, canvasWidth, canvasHeight);
        projectedPoints.push(sp);
      }

      if (projectedPoints.length > 0) {
        renderPolyline(context, projectedPoints, baseColor, lineWidth);
      }
    }
  });
}
