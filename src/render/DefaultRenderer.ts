import type { ControlState } from "../app/appInternals.js";
import type {
  ControlInput,
  DomainCameraPose,
  HudRenderData,
  PlanetSceneObject,
  PointLight,
  ProfilerController,
  Scene,
  SceneObject,
} from "../app/appPorts.js";
import type { RenderSurface2D } from "./renderPorts.js";
import { getSignedThrustPercent } from "../app/controls.js";
import { fps } from "../app/fps.js";
import { ViewComposer } from "./ViewComposer.js";
import { getShipById } from "../app/worldLookup.js";
import type { Vec3, World } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type { ViewController } from "./ViewController.js";
import { toRenderable } from "./renderPrep.js";
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
import { buildShadedFaces } from "./shadedFaces.js";

/**
 * Default implementation of the top-level Renderer abstraction.
 */
export class DefaultRenderer implements Renderer {
  constructor(
    private readonly faceRenderer: FaceRenderer,
    private readonly polylineRenderer: PolylineRenderer,
    private readonly overlayRenderer: ViewDebugOverlayRenderer,
    private readonly hudRenderer: HudRenderer,
    private profilerController: ProfilerController,
  ) {}

  // Single shared view composer instance for all views.
  private viewComposer = new ViewComposer();

  /**
   * Render the current world/scene state using the configured renderer.
   */
  renderCurrentFrame({
    input,
    controlState,
    scene,
    world,
    mainShipId,
    pilotCamera,
    topCamera,
    pilotSurface,
    topSurface,
    pilotCameraLocalOffset,
  }: {
    input: ControlInput;
    controlState: ControlState;
    scene: Scene;
    world: World;
    mainShipId: string;
    pilotCamera: DomainCameraPose;
    topCamera: DomainCameraPose;
    pilotSurface: RenderSurface2D;
    topSurface: RenderSurface2D;
    pilotCameraLocalOffset: Vec3;
  }): void {
    const mainShip = getShipById(world, mainShipId);
    const profilingEnabled = this.profilerController.isEnabled();
    const thrustPercent = getSignedThrustPercent(input, controlState);

    const pilotViewConfig = this.viewComposer.buildPilotView(
      pilotCamera,
      mainShip,
      "faces",
      pilotSurface,
    );

    // Pilot scene: full scene, unfiltered
    const pilotScene: Scene = scene;

    const topViewConfig = this.viewComposer.buildTopView(
      topCamera,
      mainShip,
      "faces",
      topSurface,
    );

    // Top scene: no trajectory polylines
    const topScene: Scene = {
      objects: scene.objects.filter((obj) => {
        if (obj.kind === "polyline" && obj.id.startsWith("path:")) {
          return false;
        }
        return true;
      }),
      lights: scene.lights,
    };

    const hud: HudRenderData = {
      speedMps: vec3.length(mainShip.velocity),
      fps,
      profilingEnabled,
      pilotCameraLocalOffset: pilotCameraLocalOffset,
      thrustPercent,
    };

    this.renderFrame(
      pilotScene,
      topScene,
      pilotSurface,
      topSurface,
      pilotViewConfig,
      topViewConfig,
      hud,
    );
  }

  private renderFrame(
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

    if (drawMode === "faces") {
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

      this.drawMeshPolylinesWorldSpace(
        surface,
        objects.filter((obj) => obj.wireframeOnly),
        controller,
      );
    } else {
      this.drawMeshPolylinesWorldSpace(surface, objects, controller);
    }
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
