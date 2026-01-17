import type { Profiler } from "../profiling/profilingPorts.js";
import {
  ViewRenderer,
  ViewRendererParams,
  ScreenPoint,
} from "../render/renderInternals.js";
import type { View } from "../render/renderPorts.js";
import { SceneObject, type PointLight } from "../render/scenePorts.js";
import { toRenderable } from "../scene/renderPrep.js";
import { buildShadedFaces } from "../scene/shadedFaces.js";
import { renderShadedFaces, renderPolyline } from "./canvasRasterizer.js";

interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lights: PointLight[];
  profiler: Profiler;
  frameId: number;
}

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
    { objects, view, lights, profiler, frameId }: DrawOptions,
  ): void {
    const { width, height } = context.canvas;

    profiler.run("DRAW", "total", () => {
      if (view.drawMode === "faces") {
        profiler.run("DRAW", "faces", () => {
          // Solid objects use shaded‑face path
          const faceList = buildShadedFaces({
            objects,

            view,
            canvasWidth: width,
            canvasHeight: height,
            lights,
            frameId,
          });

          renderShadedFaces(context, faceList);
        });

        profiler.run("DRAW", "wireframeOnly", () => {
          this.drawMeshPolylinesWorldSpace(
            context,
            objects.filter((obj) => obj.wireframeOnly),
            view,
          );
        });
      } else {
        profiler.run("DRAW", "lines", () => {
          this.drawMeshPolylinesWorldSpace(context, objects, view);
        });
      }
    });
  }

  /**
   * Draw mesh faces as polylines by projecting world‑space vertices via the
   * view's projection function.
   */
  private drawMeshPolylinesWorldSpace(
    context: CanvasRenderingContext2D,
    objects: SceneObject[],
    view: View,
  ): void {
    const projectedPoints: ScreenPoint[] = [];
    const { projection } = view;
    const { width, height } = context.canvas;

    objects.forEach((obj) => {
      const { mesh, worldPoints, baseColor, lineWidth } = toRenderable(obj);
      const { faces } = mesh;

      for (let i = 0; i < faces.length; i++) {
        const polyIndices = faces[i];
        projectedPoints.length = 0;

        for (let j = 0; j < polyIndices.length; j++) {
          const idx = polyIndices[j];
          const wp = worldPoints[idx];

          const ndc = projection(wp);
          if (!ndc) {
            projectedPoints.length = 0;
            break;
          }

          const x = (ndc.x + 1) * 0.5 * width;
          const y = (1 - ndc.y) * 0.5 * height;

          projectedPoints.push({
            x,
            y,
            depth: ndc.depth,
          });
        }

        if (projectedPoints.length > 0) {
          renderPolyline(context, projectedPoints, baseColor, lineWidth);
        }
      }
    });
  }
}
