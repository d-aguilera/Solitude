import type { DrawMode } from "../app/appPorts.js";
import type { Scene } from "../appScene/appScenePorts.js";
import type { DomainCameraPose, Vec3 } from "../domain/domainPorts.js";
import { ProjectionService } from "../scene/ProjectionService.js";
import type { Camera, NdcPoint } from "../scene/scenePorts.js";
import type {
  RenderPlane,
  ViewDebugOverlay,
  ViewDebugOverlayRenderer,
} from "../render/renderPorts.js";
import { drawPlaneVelocityLine, drawBodyLabels } from "./debugDraw.js";

/**
 * Adapter-level controller for a concrete rendered view.
 *
 * Responsibilities:
 *  - Maintain a ProjectionService for a given camera pose and canvas size
 *  - Expose camera-space projection helpers for renderers
 *  - Provide the standard debug overlay behavior used by pilot/top views
 */
export class ViewController {
  private readonly projectionService: ProjectionService;
  private readonly camera: Camera;
  private readonly referencePlane: RenderPlane;
  private readonly drawMode: DrawMode;
  private readonly debugOverlay: ViewDebugOverlay;
  private readonly width: number;
  private readonly height: number;

  constructor(params: {
    pose: DomainCameraPose;
    canvasWidth: number;
    canvasHeight: number;
    referencePlane: RenderPlane;
    drawMode: DrawMode;
  }) {
    const { pose, canvasWidth, canvasHeight, referencePlane, drawMode } =
      params;

    this.projectionService = new ProjectionService(
      {
        position: pose.position,
        frame: pose.frame,
      },
      canvasWidth,
      canvasHeight,
    );

    this.camera = {
      position: pose.position,
      frame: pose.frame,
    };

    this.referencePlane = referencePlane;
    this.drawMode = drawMode;
    this.width = canvasWidth;
    this.height = canvasHeight;

    this.debugOverlay = {
      draw: (overlay: ViewDebugOverlayRenderer, scene: Scene) => {
        drawPlaneVelocityLine(
          overlay,
          (p: Vec3) => this.project(p),
          this.referencePlane,
          this.width,
          this.height,
        );
        drawBodyLabels(
          overlay,
          (p: Vec3) => this.project(p),
          scene,
          this.referencePlane.position,
          this.width,
          this.height,
        );
      },
    };
  }

  /**
   * World-space -> NDC projection with near-plane rejection.
   */
  project(worldPoint: Vec3): NdcPoint | null {
    return this.projectionService.projectWorldPointToNdc(worldPoint);
  }

  /**
   * Accessor for the underlying camera pose used by this view.
   */
  getCamera(): Camera {
    return this.camera;
  }

  /**
   * Accessor for the debug overlay associated with this view.
   */
  getDebugOverlay(): ViewDebugOverlay {
    return this.debugOverlay;
  }

  /**
   * Accessor for the draw mode associated with this view.
   */
  getDrawMode(): DrawMode {
    return this.drawMode;
  }
}
