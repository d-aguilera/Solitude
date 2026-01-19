import { getDomainCameraById } from "../domain/worldLookup.js";
import { ViewController } from "../projection/ViewController.js";
import { ViewConfig } from "../render/ViewConfig.js";
import type { RenderShip } from "../render/renderPorts.js";
import type { Ship, AppWorld } from "./appInternals.js";
import type { DrawMode } from "./appPorts.js";

/**
 * Adapter-level helper responsible for composing ViewConfig instances
 * for different viewpoints (pilot, top, etc.).
 *
 * Responsibilities:
 *  - Mapping AppWorld cameras and ships into render-layer DTOs
 *  - Delegating projection-specific work to ViewController
 */
export class ViewComposer {
  /**
   * Convert an app-layer Ship into the minimal RenderShip DTO.
   */
  private toRenderShip(ship: Ship): RenderShip {
    return {
      id: ship.id,
      position: ship.position,
      velocity: ship.velocity,
    };
  }

  /**
   * Build the pilot view configuration for the given camera and reference ship.
   */
  buildPilotView(
    world: AppWorld,
    cameraId: string,
    referenceShip: Ship,
    drawMode: DrawMode,
    canvasWidth: number,
    canvasHeight: number,
  ): ViewConfig {
    const camera = getDomainCameraById(world, cameraId);
    const ship = this.toRenderShip(referenceShip);

    const controller = new ViewController({
      pose: camera,
      canvasWidth,
      canvasHeight,
      referenceShip: ship,
      drawMode,
    });

    return new ViewConfig(controller);
  }

  /**
   * Build the top view configuration for the given camera and reference ship.
   */
  buildTopView(
    world: AppWorld,
    cameraId: string,
    referenceShip: Ship,
    drawMode: DrawMode,
    canvasWidth: number,
    canvasHeight: number,
  ): ViewConfig {
    const camera = getDomainCameraById(world, cameraId);
    const ship = this.toRenderShip(referenceShip);

    const controller = new ViewController({
      pose: camera,
      canvasWidth,
      canvasHeight,
      referenceShip: ship,
      drawMode,
    });

    return new ViewConfig(controller);
  }
}
