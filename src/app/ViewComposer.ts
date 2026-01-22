import type { DomainCameraPose } from "./appPorts.js";
import { ViewController } from "../projection/ViewController.js";
import type { RenderShip } from "../render/renderPorts.js";
import type { RenderSurface2D } from "./appPorts.js";
import type { Ship } from "./appInternals.js";
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
    pose: DomainCameraPose,
    referenceShip: Ship,
    drawMode: DrawMode,
    surface: RenderSurface2D,
  ): ViewController {
    const ship = this.toRenderShip(referenceShip);

    return new ViewController({
      pose,
      surface,
      referenceShip: ship,
      drawMode,
    });
  }

  /**
   * Build the top view configuration for the given camera and reference ship.
   */
  buildTopView(
    pose: DomainCameraPose,
    referenceShip: Ship,
    drawMode: DrawMode,
    surface: RenderSurface2D,
  ): ViewController {
    const ship = this.toRenderShip(referenceShip);

    return new ViewController({
      pose,
      surface,
      referenceShip: ship,
      drawMode,
    });
  }
}
