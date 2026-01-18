import { getDomainCameraById } from "../domain/worldLookup.js";
import { ViewController } from "../projection/ViewController.js";
import { ViewConfig } from "../render/ViewConfig.js";
import type { RenderPlane } from "../render/renderPorts.js";
import type { Plane, AppWorld } from "./appInternals.js";
import type { DrawMode } from "./appPorts.js";

/**
 * Adapter-level helper responsible for composing ViewConfig instances
 * for different viewpoints (pilot, top, etc.).
 *
 * Responsibilities:
 *  - Mapping AppWorld cameras and planes into render-layer DTOs
 *  - Delegating projection-specific work to ViewController
 */
export class ViewComposer {
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
    const plane = this.toRenderPlane(referencePlane);

    const controller = new ViewController({
      pose: camera,
      canvasWidth,
      canvasHeight,
      referencePlane: plane,
      drawMode,
    });

    return new ViewConfig(controller);
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
    const plane = this.toRenderPlane(referencePlane);

    const controller = new ViewController({
      pose: camera,
      canvasWidth,
      canvasHeight,
      referencePlane: plane,
      drawMode,
    });

    return new ViewConfig(controller);
  }
}
