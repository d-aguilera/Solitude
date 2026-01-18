import type { DrawMode } from "../app/appPorts.js";
import type { Scene } from "../appScene/appScenePorts.js";
import type { DomainCameraPose, Vec3 } from "../domain/domainPorts.js";
import { ProjectionService } from "../scene/ProjectionService.js";
import type { NdcPoint } from "../scene/scenePorts.js";
import type { View, ViewDebugOverlay } from "../render/renderPorts.js";
import type { RenderPlane } from "../render/renderPorts.js";
import { drawPlaneVelocityLine, drawBodyLabels } from "./debugDraw.js";

/**
 * Adapter-level representation of a concrete rendered view.
 *
 * Responsibilities:
 *  - Maintain a ProjectionService for a given camera pose and canvas size
 *  - Expose a View with a projection fn compatible with renderers
 *  - Provide the standard debug overlay behavior used by pilot/top views
 */
export class ViewInstance {
  private readonly projectionService: ProjectionService;
  private readonly projectionFn: (p: Vec3) => NdcPoint | null;
  private readonly view: View;
  private readonly debugOverlay: ViewDebugOverlay;

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

    this.projectionFn = (p: Vec3): NdcPoint | null => {
      return this.projectionService.projectWorldPointToNdc(p);
    };

    this.view = {
      camera: {
        position: pose.position,
        frame: pose.frame,
      },
      projection: this.projectionFn,
      drawMode,
    };

    this.debugOverlay = {
      draw: (ctx: CanvasRenderingContext2D, scene: Scene) => {
        drawPlaneVelocityLine(ctx, this.projectionFn, referencePlane);
        drawBodyLabels(ctx, this.projectionFn, scene, referencePlane.position);
      },
    };
  }

  /**
   * Accessor for the underlying View used by renderers.
   */
  getView(): View {
    return this.view;
  }

  /**
   * Accessor for the standard debug overlay associated with this view.
   */
  getDebugOverlay(): ViewDebugOverlay {
    return this.debugOverlay;
  }
}
