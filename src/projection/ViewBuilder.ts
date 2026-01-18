import type { DrawMode } from "../app/appPorts.js";
import type { DomainCameraPose } from "../domain/domainPorts.js";
import type { ViewConfig } from "../render/renderPorts.js";
import type { RenderPlane } from "../render/renderPorts.js";
import { ViewInstance } from "./ViewInstance.js";

/**
 * Builder for projection-aware view configurations.
 *
 * Responsibilities:
 *  - Adapting DomainCameraPose into a render-layer View and projection fn
 *  - Constructing ViewInstance objects that own projection and debug overlay
 */
export class ViewBuilder {
  /**
   * Build a ViewConfig backed by a ViewInstance from a domain camera pose.
   */
  buildViewConfig(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
    referencePlane: RenderPlane,
    drawMode: DrawMode,
  ): ViewConfig {
    const instance = new ViewInstance({
      pose,
      canvasWidth,
      canvasHeight,
      referencePlane,
      drawMode,
    });

    return {
      view: instance.getView(),
      debugOverlay: instance.getDebugOverlay(),
      referencePlane,
      drawMode,
    };
  }
}
