import type { HudRenderData } from "../app/appPorts.js";
import type {
  PointLight,
  Scene,
  SceneObject,
} from "../appScene/appScenePorts.js";
import type { Profiler } from "../domain/domainPorts.js";
import type { Renderer, ScreenPoint } from "../render/renderPorts.js";
import { buildShadedFaces, ndcToScreen } from "../render/shadedFaces.js";
import type { ViewConfig } from "../render/ViewConfig.js";
import { toRenderable } from "../scene/renderPrep.js";
import { renderCanvasHud } from "./CanvasHudRenderer.js";
import { renderPolyline, renderShadedFaces } from "./canvasRasterizer.js";

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 */
export class CanvasRenderer implements Renderer {
  private viewFrameCounter = 0;

  constructor(private profiler: Profiler) {}

  renderFrame(
    pilotScene: Scene,
    topScene: Scene,
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D,
    pilotView: ViewConfig,
    topView: ViewConfig,
    hud: HudRenderData,
  ): void {
    this.renderView(pilotView, pilotScene, pilotContext);
    this.renderView(topView, topScene, topContext);
    renderCanvasHud(pilotContext, hud);
  }

  private renderView(
    viewConfig: ViewConfig,
    scene: Scene,
    context: CanvasRenderingContext2D,
  ): void {
    const controller = viewConfig.getController();

    this.clear(context);
    this.draw(context, {
      objects: scene.objects,
      lights: scene.lights,
      frameId: ++this.viewFrameCounter,
      controller,
    });

    controller.getDebugOverlay().draw(context, scene);
  }

  /**
   * Clears the entire canvas for a new frame.
   */
  clear(context: CanvasRenderingContext2D): void {
    const { width, height } = context.canvas;

    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
  }

  private draw(
    context: CanvasRenderingContext2D,
    params: {
      objects: SceneObject[];
      lights: PointLight[];
      frameId: number;
      controller: import("../projection/ViewController.js").ViewController;
    },
  ): void {
    const { width, height } = context.canvas;
    const { objects, lights, frameId, controller } = params;

    const camera = controller.getCamera();
    const drawMode = controller.getDrawMode();

    this.profiler.run("DRAW", "total", () => {
      if (drawMode === "faces") {
        this.profiler.run("DRAW", "faces", () => {
          // Solid objects use shaded‑face path
          const faceList = buildShadedFaces({
            objects,
            camera,
            canvasWidth: width,
            canvasHeight: height,
            lights,
            frameId,
          });

          renderShadedFaces(context, faceList);
        });

        this.profiler.run("DRAW", "wireframe", () => {
          this.drawMeshPolylinesWorldSpace(
            context,
            objects.filter((obj) => obj.wireframeOnly),
            controller,
          );
        });
      } else {
        this.profiler.run("DRAW", "lines", () => {
          this.drawMeshPolylinesWorldSpace(context, objects, controller);
        });
      }
    });
  }

  /**
   * Draw mesh faces as polylines by projecting world‑space vertices via the
   * view controller and mapping to screen space using the camera.
   */
  private drawMeshPolylinesWorldSpace(
    context: CanvasRenderingContext2D,
    objects: SceneObject[],
    controller: import("../projection/ViewController.js").ViewController,
  ): void {
    const projectedPoints: ScreenPoint[] = [];
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

          const ndc = controller.project(wp);
          if (!ndc) {
            projectedPoints.length = 0;
            break;
          }

          const screenPoint = ndcToScreen(ndc, width, height);
          projectedPoints.push(screenPoint);
        }

        if (projectedPoints.length > 0) {
          renderPolyline(context, projectedPoints, baseColor, lineWidth);
        }
      }
    });
  }
}
