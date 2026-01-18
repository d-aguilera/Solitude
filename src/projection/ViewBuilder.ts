import type { DrawMode } from "../app/appPorts.js";
import type { Scene } from "../appScene/appScenePorts.js";
import type { DomainCameraPose, Vec3 } from "../domain/domainPorts.js";
import type { View, ViewDebugOverlay } from "../render/renderPorts.js";
import { ProjectionService } from "../scene/ProjectionService.js";
import type { NdcPoint } from "../scene/scenePorts.js";
import { drawPlaneVelocityLine, drawBodyLabels } from "./debugDraw.js";
import type { DebugPlane } from "./projectionPorts.js";

/**
 * Builder for projection-aware view configurations.
 *
 * Responsibilities kept here:
 *  - Adapting DomainCameraPose into a render-layer Camera and projection fn
 *  - Building View and ViewDebugOverlay instances
 */
export class ViewBuilder {
  /**
   * Build the default debug overlay used by pilot/top views.
   *
   * The overlay works with a minimal DebugPlane DTO so it does not depend
   * on any app-level world types.
   */
  private makeStandardViewDebugOverlay(options: {
    projection: (p: Vec3) => NdcPoint | null;
    referencePlane: DebugPlane;
  }): ViewDebugOverlay {
    const { projection, referencePlane } = options;

    return {
      draw: (ctx: CanvasRenderingContext2D, scene: Scene) => {
        drawPlaneVelocityLine(ctx, projection, referencePlane);
        drawBodyLabels(ctx, projection, scene, referencePlane.position);
      },
    };
  }

  /**
   * Build a View and its associated debug overlay from a domain camera pose.
   */
  buildViewConfig(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
    referencePlane: DebugPlane,
    drawMode: DrawMode,
  ): { view: View; debugOverlay: ViewDebugOverlay } {
    const projectionService = new ProjectionService(
      {
        position: pose.position,
        frame: pose.frame,
      },
      canvasWidth,
      canvasHeight,
    );

    const projection = (p: Vec3): NdcPoint | null => {
      return projectionService.projectWorldPointToNdc(p);
    };

    const view: View = {
      camera: {
        position: pose.position,
        frame: pose.frame,
      },
      projection,
      drawMode,
    };

    const debugOverlay = this.makeStandardViewDebugOverlay({
      projection,
      referencePlane,
    });

    return { view, debugOverlay };
  }
}
