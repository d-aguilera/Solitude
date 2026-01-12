import type { Renderer } from "../../app/renderer.js";
import type {
  DrawMode,
  Plane,
  Profiler,
  Scene,
  Vec3,
  WorldState,
} from "../../world/types.js";
import {
  renderPilotView as renderPilotViewImpl,
  renderTopView as renderTopViewImpl,
} from "../projection/viewRenderer.js";
import { renderHUD } from "../../app/hud.js";
import { isProfilingEnabled } from "../../profiling/profilingFacade.js";
import type { ViewRenderer } from "../projection/viewRendererPort.js";

/**
 * Canvas2D implementation of the ViewRenderer abstraction.
 *
 * This adapter owns all knowledge about concrete CanvasRenderingContext2D
 * instances and how pilot/top views + HUD are drawn into them.
 */
export class CanvasViewRenderer implements ViewRenderer {
  private readonly pilotContext: CanvasRenderingContext2D;
  private readonly topContext: CanvasRenderingContext2D;

  constructor(
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D
  ) {
    this.pilotContext = pilotContext;
    this.topContext = topContext;
  }

  renderPilotView(params: {
    scene: Scene;
    world: WorldState;
    pilotCameraId: string;
    referencePlane: Plane;
    drawMode: DrawMode;
    debugPlanes: Plane[];
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
  }): void {
    const {
      scene,
      world,
      pilotCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
    } = params;

    renderPilotViewImpl(
      this.pilotContext,
      scene,
      world,
      pilotCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent
    );
  }

  renderTopView(params: {
    scene: Scene;
    world: WorldState;
    topCameraId: string;
    referencePlane: Plane;
    drawMode: DrawMode;
    debugPlanes: Plane[];
    profiler: Profiler;
  }): void {
    const {
      scene,
      world,
      topCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler,
    } = params;

    renderTopViewImpl(
      this.topContext,
      scene,
      world,
      topCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler
    );
  }

  /**
   * Convenience for drawing HUD into the pilot view canvas.
   *
   * HUD composition is intentionally not part of ViewRenderer so that
   * the app layer can choose if/how HUD overlays are composed with views.
   */
  renderHudOverlay(
    mainPlane: Plane,
    pilotCameraLocalOffset: Vec3,
    thrustPercent: number
  ): void {
    renderHUD(
      this.pilotContext,
      mainPlane,
      isProfilingEnabled(),
      pilotCameraLocalOffset,
      thrustPercent
    );
  }
}

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 *
 * This adapter relies on an external ViewRenderer instance for per-view
 * drawing, and wires in HUD drawing on top of the pilot view when the
 * ViewRenderer is a CanvasViewRenderer.
 */
export class CanvasRenderer implements Renderer {
  constructor(
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D
  ) {
    // Constructor remains in place so callers can construct this class
    // with whatever contexts they choose. The concrete ViewRenderer
    // instance is provided to renderFrame from the app layer.
    void pilotContext;
    void topContext;
  }

  renderFrame(params: {
    scene: Scene;
    world: WorldState;
    mainPlane: Plane;
    mainPlaneId: string;
    topCameraId: string;
    pilotCameraId: string;
    debugPlanes: Plane[];
    drawMode: DrawMode;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
    viewRenderer: ViewRenderer;
  }): void {
    const {
      scene,
      world,
      mainPlane,
      topCameraId,
      pilotCameraId,
      debugPlanes,
      drawMode,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
      viewRenderer,
    } = params;

    // Delegate per-view drawing to the provided ViewRenderer.
    viewRenderer.renderPilotView({
      scene,
      world,
      pilotCameraId,
      referencePlane: mainPlane,
      drawMode,
      debugPlanes,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
    });

    viewRenderer.renderTopView({
      scene,
      world,
      topCameraId,
      referencePlane: mainPlane,
      drawMode,
      debugPlanes,
      profiler,
    });

    // If the ViewRenderer is a CanvasViewRenderer, compose the HUD on top.
    if (viewRenderer instanceof CanvasViewRenderer) {
      viewRenderer.renderHudOverlay(
        mainPlane,
        pilotCameraLocalOffset,
        thrustPercent
      );
    }
  }
}
