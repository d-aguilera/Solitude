import { getDomainCameraById } from "../domain/worldLookup.js";
import type { DebugPlane } from "../projection/projectionPorts.js";
import { ViewBuilder } from "../projection/ViewBuilder.js";
import type { RenderPlane, ViewConfig } from "../render/renderPorts.js";
import type { DrawMode } from "./appPorts.js";
import type { Plane, AppWorld } from "./appInternals.js";

/**
 * Adapter-level helper responsible for composing ViewConfig instances
 * for different viewpoints (pilot, top, etc.).
 *
 * Responsibilities kept here:
 *  - Mapping AppWorld cameras and planes into render-layer DTOs
 *  - Delegating projection-specific work to ViewBuilder
 */
export class ViewComposer {
  private readonly viewBuilder: ViewBuilder;

  constructor(viewBuilder?: ViewBuilder) {
    this.viewBuilder = viewBuilder ?? new ViewBuilder();
  }

  /**
   * Convert an app-layer Plane into the minimal RenderPlane DTO.
   */
  private toRenderPlane(plane: Plane): RenderPlane {
    return {
      id: plane.id,
      position: plane.position,
      velocity: plane.velocity,
    };
  }

  /**
   * Convert an app-layer Plane into the minimal DebugPlane DTO.
   */
  private toDebugPlane(plane: Plane): DebugPlane {
    return {
      id: plane.id,
      position: plane.position,
      velocity: plane.velocity,
    };
  }

  /**
   * Build the pilot view configuration for the given camera and reference plane.
   */
  buildPilotView(
    world: AppWorld,
    cameraId: string,
    referencePlane: Plane,
    drawMode: DrawMode,
    canvasWidth: number,
    canvasHeight: number,
  ): ViewConfig {
    const camera = getDomainCameraById(world, cameraId);
    const plane = this.toDebugPlane(referencePlane);

    const { view, debugOverlay } = this.viewBuilder.buildViewConfig(
      camera,
      canvasWidth,
      canvasHeight,
      plane,
      drawMode,
    );

    return {
      view,
      debugOverlay,
      referencePlane: this.toRenderPlane(referencePlane),
      drawMode,
    };
  }

  /**
   * Build the top view configuration for the given camera and reference plane.
   */
  buildTopView(
    world: AppWorld,
    cameraId: string,
    referencePlane: Plane,
    drawMode: DrawMode,
    canvasWidth: number,
    canvasHeight: number,
  ): ViewConfig {
    const camera = getDomainCameraById(world, cameraId);
    const plane = this.toDebugPlane(referencePlane);

    const { view, debugOverlay } = this.viewBuilder.buildViewConfig(
      camera,
      canvasWidth,
      canvasHeight,
      plane,
      drawMode,
    );

    return {
      view,
      debugOverlay,
      referencePlane: this.toRenderPlane(referencePlane),
      drawMode,
    };
  }
}
