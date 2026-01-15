import { LocalFrame, Vec3 } from "../../world/domain.js";
import { SceneObject } from "../../world/types.js";
import {
  NEAR,
  projectCameraPoint,
  ScreenPoint,
} from "../projection/projection.js";
import type {
  ViewRenderer,
  ViewRendererParams,
} from "../projection/viewRendererPort.js";
import { toRenderable } from "../scene/renderPrep.js";
import { DrawOptions } from "../scene/sceneTypes.js";
import {
  buildShadedFaces,
  getCameraPointsForObject,
} from "../scene/shadedFaces.js";
import { renderPolyline, renderShadedFaces } from "./canvasRasterizer.js";

/**
 * Canvas2D implementation of the ViewRenderer abstraction.
 *
 * This adapter owns all knowledge about concrete CanvasRenderingContext2D
 * instances and how pilot/top views + HUD are drawn into them.
 * The application/game layer does not know about these contexts.
 */
export class CanvasViewRenderer implements ViewRenderer {
  private viewFrameCounter = 0;

  renderView(params: ViewRendererParams): void {
    const { context, scene, viewConfig, profiler } = params;
    const { view, debugOverlay } = viewConfig;

    this.clear(context);
    this.draw(context, {
      objects: scene.objects,
      view,
      lights: scene.lights,
      profiler,
      frameId: ++this.viewFrameCounter,
    });

    if (debugOverlay) {
      debugOverlay.draw(context, scene);
    }
  }

  /**
   * Clears the entire canvas for a new frame.
   */
  clear(context: CanvasRenderingContext2D): void {
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
  draw(
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
          this.drawMeshPolylinesCameraSpace(
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
          this.drawMeshPolylinesCameraSpace(
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

  drawMeshPolylinesCameraSpace(
    context: CanvasRenderingContext2D,
    objects: SceneObject[],
    cameraPos: Vec3,
    cameraFrame: LocalFrame,
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

          // Skip points behind near plane
          if (cp.y < NEAR) {
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
}
