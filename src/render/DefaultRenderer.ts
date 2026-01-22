import type { HudRenderData } from "../app/appPorts.js";
import type {
  PlanetSceneObject,
  PointLight,
  Scene,
  SceneObject,
} from "../appScene/appScenePorts.js";
import type { Profiler } from "../domain/domainPorts.js";
import type { ViewController } from "../projection/ViewController.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type {
  OverlayBody,
  PolylineRenderer,
  RenderedFace,
  Renderer,
  ScreenPoint,
  FaceRenderer,
  HudRenderer,
  ViewDebugOverlayRenderer,
} from "./renderPorts.js";
import type { RenderSurface2D } from "../app/appPorts.js";
import { buildShadedFaces } from "./shadedFaces.js";
import { toRenderable } from "../scene/renderPrep.js";

/**
 * Default implementation of the top-level Renderer abstraction.
 */
export class DefaultRenderer implements Renderer {
  constructor(
    private readonly faceRenderer: FaceRenderer,
    private readonly polylineRenderer: PolylineRenderer,
    private readonly overlayRenderer: ViewDebugOverlayRenderer,
    private readonly hudRenderer: HudRenderer,
    private profiler: Profiler,
  ) {}

  renderFrame(
    pilotScene: Scene,
    topScene: Scene,
    pilotSurface: RenderSurface2D,
    topSurface: RenderSurface2D,
    pilotViewController: ViewController,
    topViewController: ViewController,
    hud: HudRenderData,
  ): void {
    this.renderView(pilotViewController, pilotScene, pilotSurface);
    this.renderView(topViewController, topScene, topSurface);
    this.hudRenderer.render(pilotSurface, hud);
  }

  private renderView(
    controller: ViewController,
    scene: Scene,
    surface: RenderSurface2D,
  ): void {
    this.clear(surface);
    this.draw(surface, {
      objects: scene.objects,
      lights: scene.lights,
      controller,
    });

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

    controller.getDebugOverlay().draw(this.overlayRenderer, overlayBodies);
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
      controller: ViewController;
    },
  ): void {
    const { width, height } = surface;
    const { objects, lights, controller } = params;

    const camera = controller.getCameraPose();
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
          });

          faceList.sort((a, b) => b.depth - a.depth);

          const renderedFaces = new Array<RenderedFace>(faceList.length);

          for (let i = 0; i < faceList.length; i++) {
            const face = faceList[i];
            const { p0, p1, p2, baseColor, intensity } = face;
            const { r: baseR, g: baseG, b: baseB } = baseColor;
            const k = 0.2 + 0.8 * intensity;
            const r = Math.round(baseR * k);
            const g = Math.round(baseG * k);
            const b = Math.round(baseB * k);
            renderedFaces[i] = {
              p0,
              p1,
              p2,
              color: { r, g, b },
            };
          }

          this.faceRenderer.render(surface, renderedFaces);
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
    controller: ViewController,
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
