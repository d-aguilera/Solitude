import type { DrawMode } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import type { DomainCameraPose } from "../app/appPorts.js";
import { ProjectionService } from "../scene/ProjectionService.js";
import type { NdcPoint } from "../scene/scenePorts.js";
import type {
  RenderShip,
  ViewDebugOverlay,
  ViewDebugOverlayRenderer,
  OverlayBody,
} from "../render/renderPorts.js";
import { drawShipVelocityLine, drawBodyLabels } from "./debugDraw.js";

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
  private readonly pose: DomainCameraPose;
  private readonly referenceShip: RenderShip;
  private readonly drawMode: DrawMode;
  private readonly debugOverlay: ViewDebugOverlay<OverlayBody[]>;
  private readonly width: number;
  private readonly height: number;

  constructor(params: {
    pose: DomainCameraPose;
    canvasWidth: number;
    canvasHeight: number;
    referenceShip: RenderShip;
    drawMode: DrawMode;
  }) {
    const { pose, canvasWidth, canvasHeight, referenceShip, drawMode } = params;

    this.projectionService = new ProjectionService(
      pose,
      canvasWidth,
      canvasHeight,
    );

    this.pose = pose;
    this.referenceShip = referenceShip;
    this.drawMode = drawMode;
    this.width = canvasWidth;
    this.height = canvasHeight;

    this.debugOverlay = {
      draw: (overlay: ViewDebugOverlayRenderer, bodies: OverlayBody[]) => {
        drawShipVelocityLine(
          overlay,
          (p: Vec3) => this.project(p),
          this.referenceShip,
          this.width,
          this.height,
        );
        drawBodyLabels(
          overlay,
          (p: Vec3) => this.project(p),
          bodies,
          this.referenceShip.position,
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
  getCameraPose(): DomainCameraPose {
    return this.pose;
  }

  /**
   * Accessor for the debug overlay associated with this view.
   */
  getDebugOverlay(): ViewDebugOverlay<OverlayBody[]> {
    return this.debugOverlay;
  }

  /**
   * Accessor for the draw mode associated with this view.
   */
  getDrawMode(): DrawMode {
    return this.drawMode;
  }
}
