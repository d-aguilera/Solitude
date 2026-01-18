import type { HudRenderData } from "../app/appPorts.js";
import type {
  PlanetSceneObject,
  PointLight,
  Scene,
  SceneObject,
} from "../appScene/appScenePorts.js";
import type { Profiler } from "../domain/domainPorts.js";
import { ndcToScreen } from "../render/ndcToScreen.js";
import type {
  OverlayBody,
  PolylineRenderer,
  RenderSurface2D,
  Renderer,
  ScreenPoint,
  ShadedFaceRenderer,
} from "../render/renderPorts.js";
import { buildShadedFaces } from "../render/shadedFaces.js";
import type { ViewConfig } from "../render/ViewConfig.js";
import { toRenderable } from "../scene/renderPrep.js";
import { CanvasDebugOverlayRenderer } from "./CanvasDebugOverlayRenderer.js";
import { CanvasHudRenderer } from "./CanvasHudRenderer.js";
import { CanvasPolylineRenderer } from "./CanvasPolylineRenderer.js";
import { CanvasShadedFaceRenderer } from "./CanvasShadedFaceRenderer.js";
import { CanvasSurface } from "./CanvasSurface.js";

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 */
export class CanvasRenderer implements Renderer {
  private viewFrameCounter = 0;
  private readonly hudRenderer = new CanvasHudRenderer();
  private readonly shadedFaceRenderer: ShadedFaceRenderer =
    new CanvasShadedFaceRenderer();
  private readonly polylineRenderer: PolylineRenderer =
    new CanvasPolylineRenderer();

  constructor(private profiler: Profiler) {}

  renderFrame(
    pilotScene: Scene,
    topScene: Scene,
    pilotSurface: RenderSurface2D,
    topSurface: RenderSurface2D,
    pilotView: ViewConfig,
    topView: ViewConfig,
    hud: HudRenderData,
  ): void {
    this.renderView(pilotView, pilotScene, pilotSurface);
    this.renderView(topView, topScene, topSurface);
    this.hudRenderer.render(pilotSurface, hud);
  }

  private renderView(
    viewConfig: ViewConfig,
    scene: Scene,
    surface: RenderSurface2D,
  ): void {
    const controller = viewConfig.getController();

    this.clear(surface);
    this.draw(surface, {
      objects: scene.objects,
      lights: scene.lights,
      frameId: ++this.viewFrameCounter,
      controller,
    });

    const canvasSurface = surface as CanvasSurface;
    const overlayRenderer = new CanvasDebugOverlayRenderer(
      canvasSurface.getContext(),
    );

    const overlayBodies: OverlayBody[] = scene.objects
      .filter(
        (obj): obj is PlanetSceneObject =>
          obj.kind === "planet" || obj.kind === "star",
      )
      .map((obj) => ({
        id: obj.id,
        position: obj.position,
        velocity: obj.velocity,
        kind: obj.kind,
      }));

    controller.getDebugOverlay().draw(overlayRenderer, overlayBodies);
  }

  /**
   * Clears the entire surface for a new frame.
   */
  clear(surface: RenderSurface2D): void {
    surface.clear("#000000");
  }

  private draw(
    surface: RenderSurface2D,
    params: {
      objects: SceneObject[];
      lights: PointLight[];
      frameId: number;
      controller: import("../projection/ViewController.js").ViewController;
    },
  ): void {
    const { width, height } = surface;
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

          this.shadedFaceRenderer.render(surface, faceList);
        });

        this.profiler.run("DRAW", "wireframe", () => {
          this.drawMeshPolylinesWorldSpace(
            surface,
            objects.filter((obj) => obj.wireframeOnly),
            controller,
          );
        });
      } else {
        this.profiler.run("DRAW", "lines", () => {
          this.drawMeshPolylinesWorldSpace(surface, objects, controller);
        });
      }
    });
  }

  /**
   * Draw mesh faces as polylines by projecting world‑space vertices via the
   * view controller and mapping to screen space using the camera.
   */
  private drawMeshPolylinesWorldSpace(
    surface: RenderSurface2D,
    objects: SceneObject[],
    controller: import("../projection/ViewController.js").ViewController,
  ): void {
    const projectedPoints: ScreenPoint[] = [];
    const { width, height } = surface;

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
          this.polylineRenderer.render(
            surface,
            projectedPoints,
            baseColor,
            lineWidth,
          );
        }
      }
    });
  }
}
